import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findRequests = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const tx = { user: { findUnique: findUser }, tutorProfileVersion: { findMany: findRequests } };
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    ...tx,
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const auth = (isAdmin: boolean) =>
  `Bearer ${signAuthToken({ sub: "44444444-4444-4444-8444-444444444444", email: "admin@example.com", isAdmin })}`;
beforeEach(() => {
  findUser.mockReset();
  findRequests.mockReset();
});
describe("AUTH-4 admin authorization and validation", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/admin/tutor-requests").expect(401);
  });
  it("rejects stale admin tokens after DB privilege removal", async () => {
    findUser.mockResolvedValue({ isAdmin: false });
    await request(app)
      .get("/api/admin/tutor-requests")
      .set("Authorization", auth(true))
      .expect(403);
    expect(findRequests).not.toHaveBeenCalled();
  });
  it("uses DB privileges when token predates promotion", async () => {
    findUser.mockResolvedValue({ isAdmin: true });
    findRequests.mockResolvedValue([]);
    await request(app)
      .get("/api/admin/tutor-requests")
      .set("Authorization", auth(false))
      .expect(200, []);
  });
  it("rejects malformed UUID", async () => {
    await request(app)
      .post("/api/admin/tutor-requests/not-a-uuid/review")
      .set("Authorization", auth(true))
      .send({ decision: "APPROVED" })
      .expect(400);
    expect(findUser).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "   "])(
    "requires a nonempty rejection reason (%s)",
    async (rejectionReason) => {
      await request(app)
        .post("/api/admin/tutor-requests/55555555-5555-4555-8555-555555555555/review")
        .set("Authorization", auth(true))
        .send({ decision: "REJECTED", rejectionReason })
        .expect(400);
      expect(findUser).not.toHaveBeenCalled();
    }
  );
});
