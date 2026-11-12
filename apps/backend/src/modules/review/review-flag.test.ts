import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

const findReview = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const createFlag = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { review: { findFirst: findReview }, reviewFlag: { create: createFlag } },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const reviewId = "11111111-1111-4111-8111-111111111111";
const authorId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";
const token = (sub: string) => signAuthToken({ sub, email: "member@example.com", isAdmin: false });
const flag = (body: object = { reason: " Abusive language " }, id = reviewId, sub = memberId) =>
  request(app)
    .post(`/api/reviews/${id}/flags`)
    .set("Authorization", `Bearer ${token(sub)}`)
    .send(body);

beforeEach(() => {
  findReview.mockReset().mockResolvedValue({ userId: authorId });
  createFlag.mockReset().mockResolvedValue({ id: "flag-1" });
});

describe("REV-3 flagging a review's comment", () => {
  it("records the flag with the trimmed reason for the signed-in member", async () => {
    const response = await flag().expect(201);

    expect(response.body).toEqual({ reviewId, flagged: true });
    expect(createFlag).toHaveBeenCalledWith({
      data: { reviewId, reporterId: memberId, reason: "Abusive language" },
    });
  });

  it("only accepts a public review that has a comment", async () => {
    await flag();

    expect(findReview).toHaveBeenCalledWith({
      where: { id: reviewId, text: { not: null }, booking: { status: { not: "CANCELLED" } } },
      select: { userId: true },
    });
  });

  it("requires a signed-in member", async () => {
    await request(app).post(`/api/reviews/${reviewId}/flags`).send({ reason: "Spam" }).expect(401);
    expect(createFlag).not.toHaveBeenCalled();
  });

  it("treats a missing, comment-less or refunded review as not found", async () => {
    findReview.mockResolvedValue(null);

    const response = await flag().expect(404);

    expect(response.body.code).toBe("REVIEW_NOT_FOUND");
    expect(createFlag).not.toHaveBeenCalled();
  });

  it("does not let an author flag their own review", async () => {
    const response = await flag(undefined, reviewId, authorId).expect(403);

    expect(response.body).toEqual({
      code: "OWN_REVIEW",
      message: "You can't flag your own review.",
    });
    expect(createFlag).not.toHaveBeenCalled();
  });

  it("rejects a duplicate flag from the same member", async () => {
    createFlag.mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" }));

    const response = await flag().expect(409);

    expect(response.body).toEqual({
      code: "ALREADY_FLAGGED",
      message: "You have already flagged this review.",
    });
  });

  it("does not hide other database failures behind a flag error", async () => {
    createFlag.mockRejectedValue(new Error("connection lost"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await flag().expect(500);
  });

  it.each([
    ["a missing reason", {}],
    ["a blank reason", { reason: "   " }],
    ["a reason over 500 characters", { reason: "x".repeat(501) }],
  ])("rejects %s", async (_label, body) => {
    await flag(body).expect(400);
    expect(findReview).not.toHaveBeenCalled();
    expect(createFlag).not.toHaveBeenCalled();
  });

  it("accepts a reason of exactly 500 characters", async () => {
    await flag({ reason: "x".repeat(500) }).expect(201);
  });

  it("rejects a review id that is not a UUID", async () => {
    await flag(undefined, "not-a-uuid").expect(400);
    expect(findReview).not.toHaveBeenCalled();
  });
});
