import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findVersion = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const createVersion = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const updateVersion = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const lock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const tx = {
  $queryRaw: lock,
  user: { findUnique: findUser },
  tutorProfileVersion: { findFirst: findVersion, create: createVersion, update: updateVersion },
};
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    ...tx,
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const auth = () =>
  `Bearer ${signAuthToken({ sub: "11111111-1111-4111-8111-111111111111", email: "user@example.com", isAdmin: false })}`;
const fields = {
  bio: "Calculus",
  introVideoUrl: "https://example.com/video",
  identificationCardUrl: "https://example.com/id",
  certificationUrl: "https://example.com/cert",
};
beforeEach(() => {
  for (const mock of [findUser, findVersion, createVersion, updateVersion, lock]) mock.mockReset();
  findUser.mockResolvedValue({ tutor: null });
  findVersion.mockResolvedValue(null);
  lock.mockResolvedValue([]);
});
describe("AUTH-4 profile validation", () => {
  it.each([
    ["put", "/api/profiles/me/tutor"],
    ["put", "/api/profiles/me/tutor/draft"],
    ["post", "/api/profiles/me/tutor/submit"],
    ["post", "/api/profiles/me/tutor/withdraw"],
    ["patch", "/api/profiles/me/tutor/publication"],
  ])("requires authentication on %s %s", async (method, path) => {
    await request(app)[method as "put" | "post" | "patch"](path!).send({}).expect(401);
    expect(lock).not.toHaveBeenCalled();
  });
  it.each(["ftp://example.com/id", "javascript:alert(1)", "invalid", ""])(
    "rejects unsafe/invalid document URL %s",
    async (identificationCardUrl) => {
      await request(app)
        .put("/api/profiles/me/tutor")
        .set("Authorization", auth())
        .send({ ...fields, identificationCardUrl, consentAccepted: true })
        .expect(400);
      expect(lock).not.toHaveBeenCalled();
    }
  );
  it.each([false, undefined])(
    "requires explicit application consent (%s)",
    async (consentAccepted) => {
      await request(app)
        .put("/api/profiles/me/tutor")
        .set("Authorization", auth())
        .send({ ...fields, consentAccepted })
        .expect(400);
    }
  );
  it.each(["/api/profiles/me/tutor", "/api/profiles/me"])(
    "validates every certificate snapshot URL on %s before persistence",
    async (path) => {
      const tutor = {
        ...fields,
        certificationUrls: [fields.certificationUrl, "javascript:alert(1)"],
      };
      await request(app)
        .put(path)
        .set("Authorization", auth())
        .send(path === "/api/profiles/me" ? { tutor } : { ...tutor, consentAccepted: true })
        .expect(400);
      expect(lock).not.toHaveBeenCalled();
      expect(createVersion).not.toHaveBeenCalled();
    }
  );
  it("refuses draft writes while a request is pending", async () => {
    findVersion.mockResolvedValue({ status: "PENDING" });
    await request(app)
      .put("/api/profiles/me/tutor/draft")
      .set("Authorization", auth())
      .send({ bio: "New bio" })
      .expect(409);
    expect(createVersion).not.toHaveBeenCalled();
    expect(updateVersion).not.toHaveBeenCalled();
  });
  it("reports NONE with both nullable records", async () => {
    const res = await request(app)
      .get("/api/profiles/me/tutor")
      .set("Authorization", auth())
      .expect(200);
    expect(res.body).toEqual({ status: "NONE", tutor: null, version: null });
  });
  it("returns 404 for a deleted account", async () => {
    findUser.mockResolvedValue(null);
    await request(app).get("/api/profiles/me/tutor").set("Authorization", auth()).expect(404);
  });
  it("refuses publication before approval", async () => {
    await request(app)
      .patch("/api/profiles/me/tutor/publication")
      .set("Authorization", auth())
      .send({ published: true })
      .expect(403);
  });
});
