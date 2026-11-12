import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import request from "supertest";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";
import { findAccountRestriction } from "./account-actions.ts";

const accountEmail = jest.fn<(...args: unknown[]) => Promise<void>>();
const actualEmail = await import("../../lib/email.ts");
jest.unstable_mockModule("../../lib/email.ts", () => ({
  ...actualEmail,
  sendAccountActionEmail: accountEmail,
}));
const { app } = await import("../../app.ts");

if (process.env.RUN_DATABASE_INTEGRATION === "true") {
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (
    database.hostname !== "127.0.0.1" ||
    database.port !== "55435" ||
    database.username !== "safe1" ||
    database.pathname !== "/tutor_matcher_safe1_test"
  ) {
    throw new Error(
      "SAFE-1 integration tests require tutor_matcher_safe1_test as safe1 on 127.0.0.1:55435"
    );
  }
}
const describeDatabase = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;

// Every fixture name carries this token, so searches ignore other rows.
const token = `safe1${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const tutorIds: string[] = [];
let adminId: string;

async function createUser(firstName: string, isAdmin = false) {
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName: token,
      email: `${token}-${firstName.toLowerCase()}@example.com`,
      password: "fixture-password",
      isAdmin,
    },
  });
  userIds.push(user.id);
  return user;
}

async function createPublishedTutor(firstName: string) {
  const user = await createUser(firstName);
  const tutor = await prisma.tutor.create({
    data: {
      status: "PUBLISHED",
      currentProfileVersion: {
        create: { userId: user.id, status: "APPROVED", bio: `${firstName} ${token}` },
      },
    },
  });
  tutorIds.push(tutor.id);
  await prisma.user.update({ where: { id: user.id }, data: { tutorId: tutor.id } });
  return { user, tutor };
}

const bearer = (user: { id: string; email: string }) =>
  `Bearer ${signAuthToken({ sub: user.id, email: user.email, isAdmin: false })}`;

function act(userId: string, body: object) {
  return request(app)
    .post(`/api/admin/users/${userId}/actions`)
    .set(
      "Authorization",
      `Bearer ${signAuthToken({ sub: adminId, email: "admin@example.com", isAdmin: true })}`
    )
    .send(body);
}

describeDatabase("SAFE-1 user management on PostgreSQL", () => {
  beforeAll(async () => {
    adminId = (await createUser("Admin", true)).id;
  });

  beforeEach(() => {
    accountEmail.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await prisma.message.deleteMany({
      where: { OR: [{ fromUserId: { in: userIds } }, { toUserId: { in: userIds } }] },
    });
    await prisma.accountAction.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { tutorId: null } });
    await prisma.tutor.deleteMany({ where: { id: { in: tutorIds } } });
    await prisma.tutorProfileVersion.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("bans an account: its open session and login stop working, and a second ban is refused", async () => {
    const bob = await createUser("Bob");
    await request(app).get("/api/auth/me").set("Authorization", bearer(bob)).expect(200);

    await act(bob.id, { type: "BAN", reason: "Fraud" }).expect(201);

    const session = await request(app)
      .get("/api/auth/me")
      .set("Authorization", bearer(bob))
      .expect(403);
    expect(session.body).toMatchObject({
      code: "ACCOUNT_RESTRICTED",
      message: "This account has been banned. Reason: Fraud",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: bob.email, password: "fixture-password" })
      .expect(403);
    expect(login.body.message).toBe("This account has been banned. Reason: Fraud");

    const again = await act(bob.id, { type: "BAN", reason: "Again" }).expect(409);
    expect(again.body).toEqual({ message: "This account is already banned" });
    const recorded = await prisma.accountAction.findMany({ where: { userId: bob.id } });
    expect(recorded).toEqual([
      expect.objectContaining({ type: "BAN", reason: "Fraud", adminId, endsAt: null }),
    ]);
    expect(accountEmail).toHaveBeenCalledTimes(1);
    expect(accountEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: bob.email,
        type: "BAN",
        reason: "Fraud",
        until: null,
      })
    );
  });

  it("suspends for the chosen days and gives access back once the suspension ends", async () => {
    const dana = await createUser("Dana");

    const suspended = await act(dana.id, { type: "SUSPEND", reason: "Spam", days: 1 }).expect(201);
    expect(suspended.body.restriction).toMatchObject({ type: "SUSPEND", reason: "Spam" });
    await request(app).get("/api/auth/me").set("Authorization", bearer(dana)).expect(403);
    const endsAt = new Date(suspended.body.restriction.endsAt);
    expect(await findAccountRestriction(dana.id, new Date(endsAt.getTime() - 1))).not.toBeNull();
    expect(await findAccountRestriction(dana.id, endsAt)).toBeNull();

    await prisma.accountAction.updateMany({
      where: { userId: dana.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
    await request(app).get("/api/auth/me").set("Authorization", bearer(dana)).expect(200);
  });

  it("records only one ban when two administration requests arrive together", async () => {
    const target = await createUser("Concurrent");
    const responses = await Promise.all([
      act(target.id, { type: "BAN", reason: "First report" }),
      act(target.id, { type: "BAN", reason: "Second report" }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const actions = await prisma.accountAction.findMany({ where: { userId: target.id } });
    expect(actions).toHaveLength(1);
    expect(accountEmail).toHaveBeenCalledTimes(1);
    expect(responses.find(({ status }) => status === 409)?.body.message).toBe(
      "This account is already banned"
    );
  });

  it("preserves the committed restriction when its email fails", async () => {
    const target = await createUser("EmailFailure");
    accountEmail.mockRejectedValueOnce(new Error("Simulated email outage"));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(target.id, { type: "BAN", reason: "Fraud" }).expect(201);
      expect(await findAccountRestriction(target.id)).toMatchObject({
        type: "BAN",
        reason: "Fraud",
      });
      await request(app).get("/api/auth/me").set("Authorization", bearer(target)).expect(403);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("rejects another suspension but allows escalating a suspension to a ban", async () => {
    const target = await createUser("Escalated");
    await act(target.id, { type: "SUSPEND", reason: "Spam", days: 7 }).expect(201);
    await act(target.id, { type: "SUSPEND", reason: "Again", days: 30 }).expect(409);
    await act(target.id, { type: "BAN", reason: "Repeated abuse" }).expect(201);
    const actions = await prisma.accountAction.findMany({ where: { userId: target.id } });
    expect(actions).toHaveLength(2);
    expect(await findAccountRestriction(target.id)).toMatchObject({
      type: "BAN",
      reason: "Repeated abuse",
    });
  });

  it("requires live Admin access and protects administrator accounts", async () => {
    const caller = await createUser("NotAdmin");
    const target = await createUser("ProtectedAdmin", true);
    const path = `/api/admin/users/${target.id}/actions`;
    await request(app).post(path).send({ type: "BAN", reason: "No access" }).expect(401);
    await request(app)
      .post(path)
      .set("Authorization", bearer(caller))
      .send({ type: "BAN", reason: "No access" })
      .expect(403);
    await act(target.id, { type: "BAN", reason: "Not permitted" }).expect(403);
    await act(adminId, { type: "BAN", reason: "Self" }).expect(403);
    expect(
      await prisma.accountAction.count({ where: { userId: { in: [target.id, adminId] } } })
    ).toBe(0);
    expect(accountEmail).not.toHaveBeenCalled();
  });

  it("starts an Admin conversation with a selected Student", async () => {
    const target = await createUser("MessageTarget");
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    await request(app)
      .post("/api/messages")
      .set("Authorization", bearer(admin))
      .send({ toUserId: target.id, message: "Please contact support." })
      .expect(201);
    const inbox = await request(app)
      .get("/api/messages/inbox")
      .set("Authorization", bearer(target))
      .expect(200);
    expect(inbox.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromUserId: adminId, message: "Please contact support." }),
      ])
    );
  });

  it("unpublishes a restricted Tutor's listing", async () => {
    const { user, tutor } = await createPublishedTutor("Tara");

    await act(user.id, { type: "SUSPEND", reason: "Missed lessons", days: 7 }).expect(201);

    expect((await prisma.tutor.findUniqueOrThrow({ where: { id: tutor.id } })).status).toBe(
      "UNPUBLISHED"
    );
  });

  it("finds accounts by every name word and by role", async () => {
    const student = await createUser("SearchBob");
    await createUser("SearchDana");
    await createPublishedTutor("SearchTara");
    await act(student.id, { type: "BAN", reason: "Fraud" }).expect(201);
    const asAdmin = (query: Record<string, string>) =>
      request(app)
        .get("/api/admin/users")
        .query(query)
        .set(
          "Authorization",
          `Bearer ${signAuthToken({ sub: adminId, email: "admin@example.com", isAdmin: true })}`
        )
        .expect(200);
    const names = (body: { results: { firstName: string }[] }) =>
      body.results.map(({ firstName }) => firstName).sort();

    expect(names((await asAdmin({ q: `searchbob ${token.toUpperCase()}` })).body)).toEqual([
      "SearchBob",
    ]);
    expect(names((await asAdmin({ q: `Search ${token}`, role: "tutor" })).body)).toEqual([
      "SearchTara",
    ]);
    expect(names((await asAdmin({ q: `Search ${token}`, role: "student" })).body)).toEqual([
      "SearchBob",
      "SearchDana",
    ]);
    const banned = (await asAdmin({ q: `searchbob ${token}` })).body.results[0];
    expect(banned.restriction).toMatchObject({ type: "BAN", reason: "Fraud", endsAt: null });
  });

  it("treats wildcard characters in a name literally", async () => {
    const exact = await createUser("Literal%_Name");
    await createUser("LiteralXXName");
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    const response = await request(app)
      .get("/api/admin/users")
      .query({ q: `Literal%_ ${token}` })
      .set("Authorization", bearer(admin))
      .expect(200);
    expect(response.body.results.map((user: { id: string }) => user.id)).toEqual([exact.id]);
  });
});
