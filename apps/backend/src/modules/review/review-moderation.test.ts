import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

type Args = { where: Record<string, unknown> } & Record<string, unknown>;

const userFindUnique = jest.fn<(args: Args) => Promise<unknown>>();
const reviewFindMany = jest.fn<(args: Args) => Promise<unknown[]>>();
const reviewFindUniqueOrThrow = jest.fn<(args: Args) => Promise<unknown>>();
// The decision runs in a transaction with its own client.
const txUserFindUnique = jest.fn<(args: Args) => Promise<unknown>>();
const txQueryRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const txReviewFindUnique = jest.fn<(args: Args) => Promise<unknown>>();
const txFlagUpdateMany = jest.fn<(args: unknown) => Promise<unknown>>();
const txReviewUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const sendReviewModerationEmail = jest.fn<(args: Record<string, unknown>) => Promise<void>>();

const tx = {
  user: { findUnique: txUserFindUnique },
  $queryRaw: txQueryRaw,
  review: { findUnique: txReviewFindUnique, update: txReviewUpdate },
  reviewFlag: { updateMany: txFlagUpdateMany },
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    // SAFE-1: requireAuth checks for a suspension or ban on every request.
    accountAction: { findFirst: async () => null },
    user: { findUnique: userFindUnique },
    review: { findMany: reviewFindMany, findUniqueOrThrow: reviewFindUniqueOrThrow },
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  },
}));
const actualEmail = await import("../../lib/email.ts");
jest.unstable_mockModule("../../lib/email.ts", () => ({
  ...actualEmail,
  sendReviewModerationEmail,
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MEMBER_ID = "00000000-0000-4000-8000-000000000002";
const REVIEW_ID = "00000000-0000-4000-8000-000000000010";
const token = (sub: string, isAdmin = true) =>
  `Bearer ${signAuthToken({ sub, email: "carol@example.com", isAdmin })}`;
const name = (firstName: string, lastName: string) => ({ firstName, lastName });
const at = (iso: string) => new Date(iso);

function flaggedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REVIEW_ID,
    ratingStars: 1,
    text: "Rude comment",
    createdAt: at("2026-11-01T00:00:00Z"),
    removedAt: null,
    removalReason: null,
    user: name("Bob", "Student"),
    removedBy: null,
    subject: { name: "Chemistry", tutor: { user: name("Anong", "Tutor") } },
    flags: [
      {
        id: "flag-1",
        reason: "Abusive",
        createdAt: at("2026-11-02T00:00:00Z"),
        outcome: null,
        decidedAt: null,
        reporter: name("Dana", "Member"),
        decidedBy: null,
      },
    ],
    ...overrides,
  };
}

const pendingForDecision = {
  removedAt: null,
  user: { email: "bob@example.com", firstName: "Bob" },
  subject: { name: "Chemistry", tutor: { user: name("Anong", "Tutor") } },
  flags: [
    { reporter: { email: "dana@example.com", firstName: "Dana" } },
    { reporter: { email: "eve@example.com", firstName: "Eve" } },
  ],
};

const decide = (body: object, sub = ADMIN_ID) =>
  request(app)
    .post(`/api/admin/reviews/${REVIEW_ID}/moderation`)
    .set("Authorization", token(sub))
    .send(body);

beforeEach(() => {
  const isAdmin = async ({ where }: Args) => ({ isAdmin: where.id === ADMIN_ID });
  userFindUnique.mockReset().mockImplementation(isAdmin);
  txUserFindUnique.mockReset().mockImplementation(isAdmin);
  reviewFindMany.mockReset().mockResolvedValue([]);
  reviewFindUniqueOrThrow.mockReset().mockResolvedValue(flaggedRow());
  txQueryRaw.mockReset().mockResolvedValue([]);
  txReviewFindUnique.mockReset().mockResolvedValue(pendingForDecision);
  txFlagUpdateMany.mockReset().mockResolvedValue({ count: 2 });
  txReviewUpdate.mockReset().mockResolvedValue({});
  sendReviewModerationEmail.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("REV-4 flagged review queue", () => {
  it("lists public reviews with pending flags, longest waiting first, with every flag", async () => {
    const newer = flaggedRow({
      id: "review-newer",
      flags: [{ ...flaggedRow().flags[0], id: "flag-2", createdAt: at("2026-11-05T00:00:00Z") }],
    });
    reviewFindMany.mockResolvedValue([newer, flaggedRow()]);

    const response = await request(app)
      .get("/api/admin/review-flags")
      .set("Authorization", token(ADMIN_ID))
      .expect(200);

    expect(reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          booking: { status: { not: "CANCELLED" } },
          removedAt: null,
          flags: { some: { outcome: null } },
        },
      })
    );
    expect(response.body.map(({ id }: { id: string }) => id)).toEqual([REVIEW_ID, "review-newer"]);
    expect(response.body[0]).toEqual({
      id: REVIEW_ID,
      rating: 1,
      comment: "Rude comment",
      createdAt: "2026-11-01T00:00:00.000Z",
      author: "Bob Student",
      tutor: "Anong Tutor",
      subject: "Chemistry",
      removed: null,
      pendingFlags: 1,
      flags: [
        {
          id: "flag-1",
          reporter: "Dana Member",
          reason: "Abusive",
          createdAt: "2026-11-02T00:00:00.000Z",
          outcome: null,
          decidedAt: null,
          decidedBy: null,
        },
      ],
    });
  });

  it("lists decided reviews, most recent decision first", async () => {
    const decidedFlag = (id: string, decidedAt: string) => ({
      ...flaggedRow().flags[0],
      outcome: "KEPT",
      decidedAt: at(decidedAt),
      decidedBy: name("Carol", "Admin"),
      id,
    });
    reviewFindMany.mockResolvedValue([
      flaggedRow({ id: "older", flags: [decidedFlag("a", "2026-11-03T00:00:00Z")] }),
      flaggedRow({ id: "newer", flags: [decidedFlag("b", "2026-11-04T00:00:00Z")] }),
    ]);

    const response = await request(app)
      .get("/api/admin/review-flags?status=DECIDED")
      .set("Authorization", token(ADMIN_ID))
      .expect(200);

    expect(reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { flags: { some: { outcome: { not: null } } } } })
    );
    expect(response.body.map(({ id }: { id: string }) => id)).toEqual(["newer", "older"]);
    expect(response.body[0].flags[0]).toMatchObject({ outcome: "KEPT", decidedBy: "Carol Admin" });
  });

  it("refuses anyone who is not an Admin in the database", async () => {
    const response = await request(app)
      .get("/api/admin/review-flags")
      .set("Authorization", token(MEMBER_ID, true))
      .expect(403);
    expect(response.body.code).toBe("ADMIN_REQUIRED");
    expect(reviewFindMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown status filter", async () => {
    await request(app)
      .get("/api/admin/review-flags?status=ALL")
      .set("Authorization", token(ADMIN_ID))
      .expect(400);
  });
});

describe("REV-4 keeping or removing a flagged review", () => {
  const now = expect.any(Date);

  it("keeps the review published, decides every pending flag, and tells each reporter", async () => {
    const response = await decide({ decision: "KEEP" }).expect(200);

    expect(txQueryRaw).toHaveBeenCalled();
    expect(txFlagUpdateMany).toHaveBeenCalledWith({
      where: { reviewId: REVIEW_ID, outcome: null },
      data: { outcome: "KEPT", decidedAt: now, decidedById: ADMIN_ID },
    });
    expect(txReviewUpdate).not.toHaveBeenCalled();
    expect(sendReviewModerationEmail.mock.calls.map(([notice]) => notice)).toEqual([
      expect.objectContaining({ to: "dana@example.com", audience: "REPORTER", outcome: "KEPT" }),
      expect.objectContaining({ to: "eve@example.com", audience: "REPORTER", outcome: "KEPT" }),
    ]);
    expect(response.body.id).toBe(REVIEW_ID);
  });

  it("removes the whole review with the reason, and tells the reporters and the author", async () => {
    await decide({ decision: "REMOVE", reason: "  Harassment  " }).expect(200);

    expect(txReviewUpdate).toHaveBeenCalledWith({
      where: { id: REVIEW_ID },
      data: { removedAt: now, removedById: ADMIN_ID, removalReason: "Harassment" },
    });
    expect(txFlagUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: "REMOVED" }) })
    );
    const notices = sendReviewModerationEmail.mock.calls.map(([notice]) => notice);
    expect(notices).toEqual([
      expect.objectContaining({ to: "dana@example.com", audience: "REPORTER", reason: null }),
      expect.objectContaining({ to: "eve@example.com", audience: "REPORTER", reason: null }),
      expect.objectContaining({
        to: "bob@example.com",
        audience: "AUTHOR",
        outcome: "REMOVED",
        reason: "Harassment",
        subjectName: "Chemistry",
        tutorName: "Anong Tutor",
      }),
    ]);
  });

  it("refuses a decision when nothing is pending, so a second Admin cannot decide twice", async () => {
    txReviewFindUnique.mockResolvedValue({ ...pendingForDecision, flags: [] });

    const response = await decide({ decision: "KEEP" }).expect(409);

    expect(response.body).toEqual({
      code: "NO_PENDING_FLAGS",
      message: "This review has no pending flags.",
    });
    expect(txFlagUpdateMany).not.toHaveBeenCalled();
    expect(sendReviewModerationEmail).not.toHaveBeenCalled();
  });

  it("refuses a review that was already removed", async () => {
    txReviewFindUnique.mockResolvedValue({ ...pendingForDecision, removedAt: new Date() });
    await decide({ decision: "REMOVE", reason: "Again" }).expect(409);
    expect(txReviewUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown review", async () => {
    txReviewFindUnique.mockResolvedValue(null);
    expect((await decide({ decision: "KEEP" }).expect(404)).body.code).toBe("REVIEW_NOT_FOUND");
  });

  it("refuses a non-admin before touching the review", async () => {
    await decide({ decision: "KEEP" }, MEMBER_ID).expect(403);
    expect(txQueryRaw).not.toHaveBeenCalled();
    expect(txFlagUpdateMany).not.toHaveBeenCalled();
  });

  it("keeps the decision when a notice email fails, and logs it", async () => {
    sendReviewModerationEmail.mockRejectedValueOnce(new Error("mail down"));
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await decide({ decision: "REMOVE", reason: "Harassment" }).expect(200);

    expect(txReviewUpdate).toHaveBeenCalled();
    expect(sendReviewModerationEmail).toHaveBeenCalledTimes(3);
    expect(logged).toHaveBeenCalledWith(
      "Could not send the review moderation email",
      expect.any(Error)
    );
  });

  it.each([
    ["a remove without a reason", { decision: "REMOVE" }],
    ["a blank reason", { decision: "REMOVE", reason: "   " }],
    ["a reason over 500 characters", { decision: "REMOVE", reason: "x".repeat(501) }],
    ["an unknown decision", { decision: "HIDE" }],
    ["an unexpected field", { decision: "KEEP", note: "extra" }],
  ])("rejects %s", async (_label, body) => {
    await decide(body).expect(400);
    expect(txFlagUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a review id that is not a UUID", async () => {
    await request(app)
      .post("/api/admin/reviews/not-a-uuid/moderation")
      .set("Authorization", token(ADMIN_ID))
      .send({ decision: "KEEP" })
      .expect(400);
  });
});
