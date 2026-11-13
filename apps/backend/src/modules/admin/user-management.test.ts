import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

type Args = { where: Record<string, unknown> } & Record<string, unknown>;

// The signed-in Admin's own restriction check (requireAuth) uses the top-level client.
const authRestriction = jest.fn<(args: unknown) => Promise<unknown>>();
const userFindUnique = jest.fn<(args: Args) => Promise<unknown>>();
const userFindMany = jest.fn<(args: Args) => Promise<unknown[]>>();
const userCount = jest.fn<(args: unknown) => Promise<number>>();
// The action itself runs in a transaction with its own client.
const txUserFindUnique = jest.fn<(args: Args) => Promise<unknown>>();
const txQueryRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const txActionFindFirst = jest.fn<(args: Args) => Promise<unknown>>();
const txActionCreate = jest.fn<(args: { data: Record<string, unknown> }) => Promise<unknown>>();
const txTutorUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const sendAccountActionEmail = jest.fn<(args: unknown) => Promise<void>>();

const tx = {
  user: { findUnique: txUserFindUnique },
  $queryRaw: txQueryRaw,
  accountAction: { findFirst: txActionFindFirst, create: txActionCreate },
  tutor: { update: txTutorUpdate },
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    accountAction: { findFirst: authRestriction },
    user: { findUnique: userFindUnique, findMany: userFindMany, count: userCount },
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  },
}));

jest.unstable_mockModule("../../lib/email.ts", () => ({
  buildPasswordResetUrl: (token: string) => `http://localhost:3000/reset-password?token=${token}`,
  // Other modules import these; stand ins keep the app's module graph loadable.
  sendPasswordResetEmail: jest.fn(),
  sendBookingNotificationEmail: jest.fn(),
  sendMessageNotificationEmail: jest.fn(),
  sendPaymentNotificationEmail: jest.fn(),
  sendTutorRequestRejectedEmail: jest.fn(),
  sendAccountActionEmail,
  sendReviewModerationEmail: jest.fn(),
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const TARGET_ID = "00000000-0000-4000-8000-000000000002";
const TUTOR_ID = "00000000-0000-4000-8000-000000000003";
const DAY_MS = 86_400_000;
const adminToken = signAuthToken({ sub: ADMIN_ID, email: "carol@example.com", isAdmin: true });

const targetRow = {
  id: TARGET_ID,
  firstName: "Bob",
  lastName: "Smith",
  email: "bob@example.com",
  isAdmin: false,
  tutorId: null,
};

function asAdmin(test: request.Test) {
  return test.set("Authorization", `Bearer ${adminToken}`);
}

// The live admin check and the account lookup share findUnique; answer each by id.
function lookups(target: Record<string, unknown> | null, adminIsAdmin = true) {
  const answer = async ({ where }: Args) =>
    where.id === ADMIN_ID ? { isAdmin: adminIsAdmin } : target;
  userFindUnique.mockImplementation(answer);
  txUserFindUnique.mockImplementation(answer);
}

beforeEach(() => {
  jest.clearAllMocks();
  authRestriction.mockResolvedValue(null);
  txActionFindFirst.mockResolvedValue(null);
  txQueryRaw.mockResolvedValue([]);
  sendAccountActionEmail.mockResolvedValue();
  lookups({ ...targetRow, accountActionsReceived: [] });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("SAFE-1 user search", () => {
  it("matches all name words and treats LIKE wildcard characters literally", async () => {
    userCount.mockResolvedValue(0);
    userFindMany.mockResolvedValue([]);

    await asAdmin(request(app).get("/api/admin/users"))
      .query({ q: "one two three four five six 50% under_score" })
      .expect(200);

    expect(userFindMany.mock.calls[0][0].where).toEqual({
      AND: ["one", "two", "three", "four", "five", "six", "50\\%", "under\\_score"].map((word) => ({
        OR: [
          { firstName: { contains: word, mode: "insensitive" } },
          { lastName: { contains: word, mode: "insensitive" } },
        ],
      })),
    });
  });

  it("matches every name word against the first or last name and pages 20 at a time", async () => {
    const endsAt = new Date(Date.now() + DAY_MS);
    userCount.mockResolvedValue(25);
    userFindMany.mockResolvedValue([
      {
        ...targetRow,
        tutorId: TUTOR_ID,
        accountActionsReceived: [{ type: "SUSPEND", reason: "Spam", endsAt }],
      },
    ]);

    const res = await asAdmin(
      request(app).get("/api/admin/users").query({ q: " bob  smith ", role: "tutor", page: "2" })
    ).expect(200);

    const query = userFindMany.mock.calls[0][0];
    expect(query.where).toEqual({
      AND: ["bob", "smith"].map((word) => ({
        OR: [
          { firstName: { contains: word, mode: "insensitive" } },
          { lastName: { contains: word, mode: "insensitive" } },
        ],
      })),
      tutorId: { not: null },
    });
    expect(query).toMatchObject({ skip: 20, take: 20 });
    expect(res.body).toEqual({
      results: [
        {
          id: TARGET_ID,
          firstName: "Bob",
          lastName: "Smith",
          email: "bob@example.com",
          isAdmin: false,
          isTutor: true,
          restriction: { type: "SUSPEND", reason: "Spam", endsAt: endsAt.toISOString() },
        },
      ],
      page: 2,
      pageSize: 20,
      total: 25,
      totalPages: 2,
    });
  });

  it("treats Students as accounts without the Tutor capability and lists everyone for All", async () => {
    userCount.mockResolvedValue(0);
    userFindMany.mockResolvedValue([]);

    await asAdmin(request(app).get("/api/admin/users").query({ role: "student" })).expect(200);
    await asAdmin(request(app).get("/api/admin/users")).expect(200);

    expect(userFindMany.mock.calls[0][0].where).toEqual({ AND: [], tutorId: null });
    expect(userFindMany.mock.calls[1][0].where).toEqual({ AND: [] });
  });

  it("is for administrators only, checked against the database", async () => {
    lookups(null, false);

    const res = await asAdmin(request(app).get("/api/admin/users")).expect(403);

    expect(res.body).toEqual({ message: "Administrator access required" });
    expect(userFindMany).not.toHaveBeenCalled();
  });
});

describe("SAFE-1 access and validation", () => {
  it("rejects signed-out searches, details and actions before database access", async () => {
    await request(app).get("/api/admin/users").expect(401);
    await request(app).get(`/api/admin/users/${TARGET_ID}`).expect(401);
    await request(app)
      .post(`/api/admin/users/${TARGET_ID}/actions`)
      .send({ type: "BAN", reason: "Fraud" })
      .expect(401);
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(txUserFindUnique).not.toHaveBeenCalled();
  });

  it("checks live admin permissions for details and account actions", async () => {
    lookups(null, false);
    await asAdmin(request(app).get(`/api/admin/users/${TARGET_ID}`)).expect(403);
    await asAdmin(request(app).post(`/api/admin/users/${TARGET_ID}/actions`))
      .send({ type: "BAN", reason: "Fraud" })
      .expect(403);
    expect(txActionCreate).not.toHaveBeenCalled();
  });

  it.each([{ role: "admin" }, { page: "0" }, { page: "1.5" }, { q: "x".repeat(101) }])(
    "rejects invalid search parameters %j before querying users",
    async (query) => {
      await asAdmin(request(app).get("/api/admin/users").query(query)).expect(400);
      expect(userFindMany).not.toHaveBeenCalled();
    }
  );

  it("rejects invalid user ids before querying users", async () => {
    await asAdmin(request(app).get("/api/admin/users/not-a-uuid")).expect(400);
    expect(userFindUnique).not.toHaveBeenCalled();
  });
});

describe("SAFE-1 user detail", () => {
  it("shows the recorded actions, newest first, and the restriction still in force", async () => {
    const later = new Date(Date.now() + 2 * DAY_MS);
    const earlier = new Date(Date.now() - DAY_MS);
    lookups({
      ...targetRow,
      accountActionsReceived: [
        {
          id: "a2",
          type: "SUSPEND",
          reason: "Spam again",
          createdAt: new Date("2026-10-20T00:00:00.000Z"),
          endsAt: later,
          admin: { firstName: "Carol", lastName: "Davis" },
        },
        {
          id: "a1",
          type: "SUSPEND",
          reason: "Spam",
          createdAt: new Date("2026-10-01T00:00:00.000Z"),
          endsAt: earlier,
          admin: { firstName: "Carol", lastName: "Davis" },
        },
      ],
    });

    const res = await asAdmin(request(app).get(`/api/admin/users/${TARGET_ID}`)).expect(200);

    expect(res.body.restriction).toEqual({
      type: "SUSPEND",
      reason: "Spam again",
      endsAt: later.toISOString(),
    });
    expect(res.body.actions.map((action: { id: string }) => action.id)).toEqual(["a2", "a1"]);
    expect(res.body.actions[1]).toEqual({
      id: "a1",
      type: "SUSPEND",
      reason: "Spam",
      createdAt: "2026-10-01T00:00:00.000Z",
      endsAt: earlier.toISOString(),
      admin: "Carol Davis",
    });
  });

  it("returns 404 for an unknown account", async () => {
    lookups(null);

    await asAdmin(request(app).get(`/api/admin/users/${TARGET_ID}`)).expect(404);
  });
});

describe("SAFE-1 suspend and ban", () => {
  const url = `/api/admin/users/${TARGET_ID}/actions`;

  it("suspends for the chosen days, unpublishes a published Tutor and emails the reason", async () => {
    lookups({
      ...targetRow,
      tutor: { id: TUTOR_ID, status: "PUBLISHED" },
      accountActionsReceived: [],
    });
    txActionCreate.mockImplementation(async ({ data }) => ({
      type: data.type,
      reason: data.reason,
      endsAt: data.endsAt,
    }));
    const before = Date.now();

    await asAdmin(request(app).post(url))
      .send({ type: "SUSPEND", reason: "Spam", days: 7 })
      .expect(201);

    expect(txQueryRaw).toHaveBeenCalledTimes(1);
    const { data } = txActionCreate.mock.calls[0][0];
    expect(data).toMatchObject({ userId: TARGET_ID, adminId: ADMIN_ID, type: "SUSPEND" });
    const endsAt = (data.endsAt as Date).getTime();
    expect(endsAt).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
    expect(endsAt).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);
    expect(txTutorUpdate).toHaveBeenCalledWith({
      where: { id: TUTOR_ID },
      data: { status: "UNPUBLISHED" },
    });
    expect(sendAccountActionEmail).toHaveBeenCalledWith({
      to: "bob@example.com",
      firstName: "Bob",
      type: "SUSPEND",
      reason: "Spam",
      until: expect.stringContaining("(Bangkok time)"),
    });
  });

  it("bans with no end date and leaves a Student's other data alone", async () => {
    txActionCreate.mockResolvedValue({ type: "BAN", reason: "Fraud", endsAt: null });

    await asAdmin(request(app).post(url)).send({ type: "BAN", reason: "Fraud" }).expect(201);

    expect(txActionCreate.mock.calls[0][0].data).toMatchObject({ type: "BAN", endsAt: null });
    expect(txTutorUpdate).not.toHaveBeenCalled();
    expect(sendAccountActionEmail).toHaveBeenCalledWith(
      expect.objectContaining({ type: "BAN", reason: "Fraud", until: null })
    );
  });

  it("rejects a second ban and says the account is already banned", async () => {
    txActionFindFirst.mockResolvedValue({ type: "BAN", reason: "Fraud", endsAt: null });

    const res = await asAdmin(request(app).post(url))
      .send({ type: "BAN", reason: "Again" })
      .expect(409);

    expect(res.body).toEqual({ message: "This account is already banned" });
    expect(txActionCreate).not.toHaveBeenCalled();
    expect(sendAccountActionEmail).not.toHaveBeenCalled();
  });

  it("rejects a new suspension while one runs, but allows a ban then", async () => {
    txActionFindFirst.mockResolvedValue({
      type: "SUSPEND",
      reason: "Spam",
      endsAt: new Date("2026-11-02T07:00:00.000Z"),
    });

    const res = await asAdmin(request(app).post(url))
      .send({ type: "SUSPEND", reason: "Spam", days: 1 })
      .expect(409);
    expect(res.body.message).toBe(
      "This account is already suspended until 2 Nov 2026, 14:00 (Bangkok time)"
    );

    txActionCreate.mockResolvedValue({ type: "BAN", reason: "Fraud", endsAt: null });
    await asAdmin(request(app).post(url)).send({ type: "BAN", reason: "Fraud" }).expect(201);
  });

  it("refuses to restrict another administrator", async () => {
    lookups({ ...targetRow, isAdmin: true });

    const res = await asAdmin(request(app).post(url))
      .send({ type: "BAN", reason: "No" })
      .expect(403);

    expect(res.body).toEqual({ message: "Administrator accounts can't be suspended or banned" });
    expect(txActionCreate).not.toHaveBeenCalled();
  });

  it("refuses to restrict your own account", async () => {
    // The Admin is both the caller and the target here, so every lookup returns the same row.
    const self = { ...targetRow, id: ADMIN_ID, isAdmin: true };
    userFindUnique.mockResolvedValue(self);
    txUserFindUnique.mockResolvedValue(self);

    const res = await asAdmin(request(app).post(`/api/admin/users/${ADMIN_ID}/actions`))
      .send({ type: "BAN", reason: "No" })
      .expect(403);

    expect(res.body).toEqual({ message: "You can't suspend or ban your own account" });
    expect(txActionCreate).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown account", async () => {
    lookups(null);

    await asAdmin(request(app).post(url)).send({ type: "BAN", reason: "Fraud" }).expect(404);
  });

  it.each([
    ["a suspension without days", { type: "SUSPEND", reason: "Spam" }],
    ["an unsupported duration", { type: "SUSPEND", reason: "Spam", days: 3 }],
    ["a ban with a duration", { type: "BAN", reason: "Fraud", days: 7 }],
    ["a missing reason", { type: "BAN", reason: "   " }],
  ])("rejects %s", async (_label, body) => {
    await asAdmin(request(app).post(url)).send(body).expect(400);

    expect(txActionCreate).not.toHaveBeenCalled();
  });

  it("keeps the restriction when the email cannot be sent", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    txActionCreate.mockResolvedValue({ type: "BAN", reason: "Fraud", endsAt: null });
    sendAccountActionEmail.mockRejectedValue(new Error("smtp down"));

    await asAdmin(request(app).post(url)).send({ type: "BAN", reason: "Fraud" }).expect(201);

    expect(consoleError).toHaveBeenCalled();
  });
});
