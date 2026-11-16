import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const accountActionFindFirst = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../lib/db.ts", () => ({
  prisma: { accountAction: { findFirst: accountActionFindFirst } },
}));

const { requireAuth } = await import("./auth.ts");
const { signAuthToken } = await import("../lib/jwt.ts");

const USER_ID = "00000000-0000-0000-0000-000000000042";
const app = express();
app.get("/protected", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

function token() {
  return signAuthToken({ sub: USER_ID, email: "ada@example.com", isAdmin: true });
}

beforeEach(() => {
  accountActionFindFirst.mockReset().mockResolvedValue(null);
});

describe("requireAuth", () => {
  it("rejects a request with no Authorization header", async () => {
    await request(app).get("/protected").expect(401);
  });

  it("rejects a malformed Authorization header", async () => {
    await request(app).get("/protected").set("Authorization", "Token abc").expect(401);
  });

  it("rejects an invalid token", async () => {
    await request(app).get("/protected").set("Authorization", "Bearer not.a.jwt").expect(401);
    expect(accountActionFindFirst).not.toHaveBeenCalled();
  });

  it("passes a valid Bearer token through and populates req.user", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body.user).toMatchObject({
      sub: USER_ID,
      email: "ada@example.com",
      isAdmin: true,
    });
  });

  it("checks the account for a ban or a suspension that has not ended", async () => {
    await request(app).get("/protected").set("Authorization", `Bearer ${token()}`).expect(200);

    const { where } = accountActionFindFirst.mock.calls[0][0] as {
      where: { userId: string; OR: Array<{ type: string; endsAt?: { gt: Date } }> };
    };
    expect(where.userId).toBe(USER_ID);
    expect(where.OR).toEqual([
      { type: "BAN" },
      { type: "SUSPEND", endsAt: { gt: expect.any(Date) } },
    ]);
  });

  it("refuses a banned account with the reason, even with a valid token", async () => {
    accountActionFindFirst.mockResolvedValue({ type: "BAN", reason: "Fraud", endsAt: null });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token()}`)
      .expect(403);

    expect(res.body).toEqual({
      code: "ACCOUNT_RESTRICTED",
      message: "This account has been banned. Reason: Fraud",
      restriction: { type: "BAN", reason: "Fraud", endsAt: null },
    });
  });

  it("refuses a suspended account and says when the suspension ends", async () => {
    const endsAt = new Date("2026-11-02T07:00:00.000Z");
    accountActionFindFirst.mockResolvedValue({ type: "SUSPEND", reason: "Spam", endsAt });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token()}`)
      .expect(403);

    expect(res.body).toMatchObject({
      code: "ACCOUNT_RESTRICTED",
      message: "This account is suspended until 2 Nov 2026, 14:00 (Bangkok time). Reason: Spam",
      restriction: { type: "SUSPEND", reason: "Spam", endsAt: endsAt.toISOString() },
    });
  });
});
