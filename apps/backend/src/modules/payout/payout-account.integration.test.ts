import { URL } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "true";
if (enabled) {
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/tutor_matcher_prof7_test"
  ) {
    throw new Error(
      "PROF-7 integration tests require the dedicated local tutor_matcher_prof7_test database"
    );
  }
}

const STUDENT = "47000000-0000-4000-8000-000000000001";
const TEACHER = "47000000-0000-4000-8000-000000000002";
const TUTOR = "47000000-0000-4000-8000-000000000003";
const userIds = [STUDENT, TEACHER];
const NUMBERS = ["1112223334", "5556667778", "9990001112"];
const authorize = (test: request.Test, userId = STUDENT) =>
  test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub: userId, email: `${userId}@example.com`, isAdmin: false })}`
  );

type AccountResponse = {
  id: string;
  bankCode: string;
  bankName: string;
  accountHolderName: string;
  maskedAccountNumber: string;
  isDefault: boolean;
  createdAt: string;
};

function expectNoFullNumber(body: unknown) {
  const text = JSON.stringify(body);
  for (const number of NUMBERS) expect(text).not.toContain(number);
}

async function addAccount(accountNumber: string, userId = STUDENT, makeDefault?: boolean) {
  const response = await authorize(
    request(app)
      .post("/api/payout-accounts")
      .send({ bankCode: "SCB", accountHolderName: "PROF7 Holder", accountNumber, makeDefault }),
    userId
  ).expect(201);
  expectNoFullNumber(response.body);
  const accounts = response.body.accounts as AccountResponse[];
  return accounts.find((account) => account.maskedAccountNumber.endsWith(accountNumber.slice(-4)))!;
}

async function listAccounts(userId = STUDENT) {
  const response = await authorize(request(app).get("/api/payout-accounts"), userId).expect(200);
  expectNoFullNumber(response.body);
  return response.body.accounts as AccountResponse[];
}

async function defaults(userId = STUDENT) {
  return prisma.payoutAccount.findMany({ where: { userId, isDefault: true } });
}

async function cleanFixtures() {
  await prisma.payoutAccount.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.updateMany({ where: { id: TEACHER }, data: { tutorId: null } });
  await prisma.tutor.deleteMany({ where: { id: TUTOR } });
  await prisma.tutorProfileVersion.deleteMany({ where: { userId: TEACHER } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

(enabled ? describe : describe.skip)("PROF-7 payout account acceptance", () => {
  beforeEach(async () => {
    await cleanFixtures();
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id,
        firstName: ["Student", "Tutor"][index],
        lastName: "PROF7",
        email: `prof7-${index}@example.com`,
        password: "unused-fixture",
      })),
    });
    await prisma.tutor.create({
      data: {
        id: TUTOR,
        status: "PUBLISHED",
        currentProfileVersion: { create: { userId: TEACHER, status: "APPROVED" } },
      },
    });
    await prisma.user.update({ where: { id: TEACHER }, data: { tutorId: TUTOR } });
  });
  afterAll(cleanFixtures);

  it("lets a Student who is not a Tutor save an account, which becomes the default", async () => {
    expect((await prisma.user.findUniqueOrThrow({ where: { id: STUDENT } })).tutorId).toBeNull();
    expect(await listAccounts()).toEqual([]);
    const banks = await authorize(request(app).get("/api/payout-accounts/banks")).expect(200);
    expect(banks.body.banks).toContainEqual({ code: "SCB", name: "Siam Commercial Bank" });

    const response = await authorize(
      request(app).post("/api/payout-accounts").send({
        bankCode: "SCB",
        accountHolderName: "  Student PROF7 ",
        accountNumber: "111-2-22333-4",
      })
    ).expect(201);
    expectNoFullNumber(response.body);
    expect(response.body.accounts).toEqual([
      expect.objectContaining({
        bankName: "Siam Commercial Bank",
        accountHolderName: "Student PROF7",
        maskedAccountNumber: "•••• 3334",
        isDefault: true,
      }),
    ]);
    const stored = await prisma.payoutAccount.findFirstOrThrow({ where: { userId: STUDENT } });
    expect(stored).toMatchObject({ accountNumber: NUMBERS[0], isDefault: true, removedAt: null });
  });

  it("works the same for a Tutor", async () => {
    await addAccount(NUMBERS[0], TEACHER);
    expect(await listAccounts(TEACHER)).toEqual([expect.objectContaining({ isDefault: true })]);
  });

  it("keeps the default when adding more and lets makeDefault replace it", async () => {
    const first = await addAccount(NUMBERS[0]);
    const second = await addAccount(NUMBERS[1]);
    expect(second.isDefault).toBe(false);
    const third = await addAccount(NUMBERS[2], STUDENT, true);
    expect(third.isDefault).toBe(true);
    expect((await defaults()).map((row) => row.id)).toEqual([third.id]);
    expect((await listAccounts()).map((account) => account.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
  });

  it("switches the default atomically, also under concurrent requests", async () => {
    const first = await addAccount(NUMBERS[0]);
    const second = await addAccount(NUMBERS[1]);
    const third = await addAccount(NUMBERS[2]);
    const response = await authorize(
      request(app).patch(`/api/payout-accounts/${second.id}/default`)
    ).expect(200);
    expectNoFullNumber(response.body);
    expect(response.body.accounts[0]).toMatchObject({ id: second.id, isDefault: true });
    expect((await defaults()).map((row) => row.id)).toEqual([second.id]);

    const results = await Promise.all(
      [first.id, third.id].map((id) =>
        authorize(request(app).patch(`/api/payout-accounts/${id}/default`))
      )
    );
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await defaults()).toHaveLength(1);
  });

  it("enforces one default per user in the database", async () => {
    await addAccount(NUMBERS[0]);
    await expect(
      prisma.payoutAccount.create({
        data: {
          userId: STUDENT,
          bankCode: "KTB",
          accountHolderName: "Second Default",
          accountNumber: NUMBERS[1],
          isDefault: true,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
    await addAccount(NUMBERS[0], TEACHER);
    expect(
      await prisma.payoutAccount.count({ where: { isDefault: true, userId: { in: userIds } } })
    ).toBe(2);
  });

  it("soft-removes the default and promotes the oldest remaining account", async () => {
    const first = await addAccount(NUMBERS[0]);
    const second = await addAccount(NUMBERS[1]);
    const third = await addAccount(NUMBERS[2], STUDENT, true);
    const response = await authorize(
      request(app).delete(`/api/payout-accounts/${third.id}`)
    ).expect(200);
    expectNoFullNumber(response.body);
    expect(response.body.accounts.map((account: AccountResponse) => account.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(response.body.accounts[0].isDefault).toBe(true);
    const removed = await prisma.payoutAccount.findUniqueOrThrow({ where: { id: third.id } });
    expect(removed.removedAt).not.toBeNull();
    expect(removed.isDefault).toBe(false);

    await authorize(request(app).delete(`/api/payout-accounts/${first.id}`)).expect(200);
    await authorize(request(app).delete(`/api/payout-accounts/${second.id}`)).expect(200);
    expect(await listAccounts()).toEqual([]);
    expect(await prisma.payoutAccount.count({ where: { userId: STUDENT } })).toBe(3);
    await authorize(request(app).delete(`/api/payout-accounts/${second.id}`)).expect(404);
    expect((await addAccount(NUMBERS[1])).isDefault).toBe(true);
  });

  it("allows five active accounts and counts removed ones out", async () => {
    const numbers = ["1000000001", "1000000002", "1000000003", "1000000004", "1000000005"];
    const saved = [];
    for (const number of numbers) saved.push(await addAccount(number));
    const blocked = await authorize(
      request(app)
        .post("/api/payout-accounts")
        .send({ bankCode: "KTB", accountHolderName: "Sixth", accountNumber: "1000000006" })
    ).expect(409);
    expect(blocked.body.code).toBe("PAYOUT_ACCOUNT_LIMIT");
    await authorize(request(app).delete(`/api/payout-accounts/${saved[4].id}`)).expect(200);
    await addAccount("1000000006");
  });

  it("only lets the owner change or remove an account", async () => {
    const account = await addAccount(NUMBERS[0]);
    await addAccount(NUMBERS[1]);
    const before = await prisma.payoutAccount.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "asc" },
    });
    await authorize(
      request(app).patch(`/api/payout-accounts/${account.id}/default`),
      TEACHER
    ).expect(404);
    await authorize(request(app).delete(`/api/payout-accounts/${account.id}`), TEACHER).expect(404);
    await request(app).delete(`/api/payout-accounts/${account.id}`).expect(401);
    expect(await listAccounts(TEACHER)).toEqual([]);
    expect(
      await prisma.payoutAccount.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: "asc" },
      })
    ).toEqual(before);
  });
});
