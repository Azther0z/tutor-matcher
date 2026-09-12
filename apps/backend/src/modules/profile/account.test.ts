import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const userFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userUpdate = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { user: { findUnique: userFindUnique, update: userUpdate } },
}));

const { app } = await import("../../app.ts");
const { signAuthToken, verifyAuthToken } = await import("../../lib/jwt.ts");

const userId = "11111111-1111-4111-8111-111111111111";

const account = {
  id: userId,
  email: "member@example.com",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  deactivatedAt: null,
};

const storedUser = { ...account, password: "current-password" };

function tokenFor(sub = userId) {
  return signAuthToken({ sub, email: account.email, isAdmin: false });
}

describe("Account settings API", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    userUpdate.mockReset();
  });

  describe("GET /api/profiles/me/account", () => {
    it("requires authentication", async () => {
      await request(app).get("/api/profiles/me/account").expect(401);
      expect(userFindUnique).not.toHaveBeenCalled();
    });

    it("returns the current email without the password", async () => {
      userFindUnique.mockResolvedValue(account);

      const response = await request(app)
        .get("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .expect(200);

      expect(response.body).toMatchObject({ id: userId, email: "member@example.com" });
      expect(response.body).not.toHaveProperty("password");
    });

    it("returns 404 for a deactivated account", async () => {
      userFindUnique.mockResolvedValue({ ...account, deactivatedAt: new Date() });

      await request(app)
        .get("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .expect(404);
    });
  });

  describe("PUT /api/profiles/me/account", () => {
    it("requires authentication", async () => {
      await request(app)
        .put("/api/profiles/me/account")
        .send({ currentPassword: "current-password", email: "new@example.com" })
        .expect(401);

      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("rejects a malformed email", async () => {
      await request(app)
        .put("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "current-password", email: "not-an-email" })
        .expect(400);

      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("rejects a new password that is shorter than the policy allows", async () => {
      await request(app)
        .put("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "current-password", newPassword: "short" })
        .expect(400);

      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("rejects a request that changes nothing", async () => {
      await request(app)
        .put("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "current-password" })
        .expect(400);

      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("rejects an incorrect current password", async () => {
      userFindUnique.mockResolvedValue(storedUser);

      await request(app)
        .put("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "wrong-password", email: "new@example.com" })
        .expect(403);

      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("rejects an email already used by another account", async () => {
      userFindUnique.mockResolvedValueOnce(storedUser).mockResolvedValueOnce({
        id: "22222222-2222-4222-8222-222222222222",
        email: "taken@example.com",
      });

      const response = await request(app)
        .put("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "current-password", email: "taken@example.com" })
        .expect(409);

      expect(response.body.message).toMatch(/already exists/);
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("saves a new email and reissues a token carrying it", async () => {
      userFindUnique.mockResolvedValueOnce(storedUser).mockResolvedValueOnce(null);
      userUpdate.mockResolvedValue({ ...account, email: "new@example.com" });

      const response = await request(app)
        .put("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "current-password", email: "new@example.com" })
        .expect(200);

      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: { email: "new@example.com", password: undefined },
        select: expect.any(Object),
      });
      expect(response.body.account.email).toBe("new@example.com");
      expect(verifyAuthToken(response.body.token).email).toBe("new@example.com");
    });

    it("saves a new password without touching the email", async () => {
      userFindUnique.mockResolvedValue(storedUser);
      userUpdate.mockResolvedValue(account);

      await request(app)
        .put("/api/profiles/me/account")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "current-password", newPassword: "a-longer-password" })
        .expect(200);

      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: { email: undefined, password: "a-longer-password" },
        select: expect.any(Object),
      });
    });
  });

  describe("POST /api/profiles/me/account/deactivate", () => {
    it("requires authentication", async () => {
      await request(app)
        .post("/api/profiles/me/account/deactivate")
        .send({ currentPassword: "current-password" })
        .expect(401);

      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("rejects an incorrect current password", async () => {
      userFindUnique.mockResolvedValue(storedUser);

      await request(app)
        .post("/api/profiles/me/account/deactivate")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "wrong-password" })
        .expect(403);

      expect(userUpdate).not.toHaveBeenCalled();
    });

    it("stamps the account as deactivated", async () => {
      const deactivatedAt = new Date("2026-09-06T00:00:00.000Z");
      userFindUnique.mockResolvedValue(storedUser);
      userUpdate.mockResolvedValue({ ...account, deactivatedAt });

      const response = await request(app)
        .post("/api/profiles/me/account/deactivate")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "current-password" })
        .expect(200);

      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: { deactivatedAt: expect.any(Date) },
        select: expect.any(Object),
      });
      expect(response.body).toEqual({ id: userId, deactivatedAt: deactivatedAt.toISOString() });
    });

    it("refuses to deactivate an already deactivated account", async () => {
      userFindUnique.mockResolvedValue({ ...storedUser, deactivatedAt: new Date() });

      await request(app)
        .post("/api/profiles/me/account/deactivate")
        .set("Authorization", `Bearer ${tokenFor()}`)
        .send({ currentPassword: "current-password" })
        .expect(404);

      expect(userUpdate).not.toHaveBeenCalled();
    });
  });
});
