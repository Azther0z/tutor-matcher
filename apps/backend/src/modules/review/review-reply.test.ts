import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findReview = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const updateReview = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    // SAFE-1: requireAuth checks for a suspension or ban on every request.
    accountAction: { findFirst: async () => null },
    user: { findUnique: findUser },
    review: { findUnique: findReview, updateMany: updateReview },
  },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const id = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const tutorId = "33333333-3333-4333-8333-333333333333";
const token = signAuthToken({ sub: userId, email: "tutor@example.com", isAdmin: false });
const submit = (body: object = { text: " Thank you! " }, reviewId = id) =>
  request(app)
    .post(`/api/reviews/${reviewId}/reply`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);

beforeEach(() => {
  findUser.mockReset().mockResolvedValue({ tutorId });
  findReview.mockReset().mockResolvedValue({ replyText: null, subject: { tutorId } });
  updateReview.mockReset().mockResolvedValue({ count: 1 });
});

describe("REV-2 editing the existing public reply", () => {
  const repliedAt = new Date("2026-11-12T00:00:00Z");
  const existing = {
    replyText: "Original reply",
    repliedAt,
    replyEditedAt: null,
    subject: { tutorId },
  };
  const edit = (
    body: object = { text: " Updated reply ", expectedUpdatedAt: repliedAt.toISOString() }
  ) =>
    request(app)
      .patch(`/api/reviews/${id}/reply`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  beforeEach(() => {
    findReview.mockResolvedValue(existing);
  });
  it("updates the single reply, preserves its original date and records Edited", async () => {
    const response = await edit().expect(200);
    expect(response.body.reply).toEqual({
      text: "Updated reply",
      repliedAt: repliedAt.toISOString(),
      editedAt: expect.any(String),
    });
    expect(updateReview).toHaveBeenCalledWith({
      where: {
        id,
        removedAt: null,
        subject: { tutorId },
        replyText: existing.replyText,
        repliedAt,
        replyEditedAt: null,
      },
      data: { replyText: "Updated reply", replyEditedAt: expect.any(Date) },
    });
  });
  it("accepts subsequent edits using the current revision", async () => {
    const replyEditedAt = new Date("2026-11-12T01:00:00Z");
    findReview.mockResolvedValue({ ...existing, replyEditedAt });
    await edit({ text: "Second edit", expectedUpdatedAt: replyEditedAt.toISOString() }).expect(200);
  });
  it("does not label an unchanged reply Edited", async () => {
    const response = await edit({
      text: existing.replyText,
      expectedUpdatedAt: repliedAt.toISOString(),
    }).expect(200);
    expect(response.body.reply).toEqual({
      text: existing.replyText,
      repliedAt: repliedAt.toISOString(),
    });
    expect(updateReview).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    await request(app)
      .patch(`/api/reviews/${id}/reply`)
      .send({ text: "Edit", expectedUpdatedAt: repliedAt.toISOString() })
      .expect(401);
    expect(updateReview).not.toHaveBeenCalled();
  });
  it("rejects Students and other Tutors", async () => {
    findUser.mockResolvedValueOnce({ tutorId: null });
    await edit().expect(403);
    findReview.mockResolvedValue({ ...existing, subject: { tutorId: "other" } });
    await edit().expect(403);
    expect(updateReview).not.toHaveBeenCalled();
  });
  it("reports a deleted review before or during editing", async () => {
    findReview.mockResolvedValueOnce(null);
    expect((await edit().expect(404)).body.code).toBe("REVIEW_NOT_FOUND");
    findReview.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    updateReview.mockResolvedValue({ count: 0 });
    expect((await edit().expect(404)).body.code).toBe("REVIEW_NOT_FOUND");
  });
  it("does not silently overwrite a stale draft or a concurrent edit", async () => {
    findReview.mockResolvedValueOnce({
      ...existing,
      replyEditedAt: new Date("2026-11-12T01:00:00Z"),
    });
    expect((await edit().expect(409)).body.code).toBe("REVIEW_REPLY_CHANGED");
    expect(updateReview).not.toHaveBeenCalled();
    updateReview.mockResolvedValue({ count: 0 });
    expect((await edit().expect(409)).body.code).toBe("REVIEW_REPLY_CHANGED");
  });
  it("requires an existing reply and valid text/revision", async () => {
    await edit({ text: "", expectedUpdatedAt: repliedAt.toISOString() }).expect(400);
    await edit({ text: "Changed" }).expect(400);
    await edit({ text: "Changed", expectedUpdatedAt: "invalid" }).expect(400);
    findReview.mockResolvedValue({ ...existing, replyText: null, repliedAt: null });
    expect((await edit().expect(409)).body.code).toBe("REVIEW_REPLY_NOT_FOUND");
    expect(updateReview).not.toHaveBeenCalled();
  });
});

describe("REV-4 replies on a removed review", () => {
  it("treats a review an Admin removed as gone for a new reply or an edit", async () => {
    findReview.mockResolvedValue(null);

    expect((await submit().expect(404)).body.code).toBe("REVIEW_NOT_FOUND");
    expect(findReview).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, removedAt: null } })
    );
    expect(updateReview).not.toHaveBeenCalled();
  });
});

describe("REV-2 public review replies", () => {
  it("requires authentication", async () => {
    await request(app).post(`/api/reviews/${id}/reply`).send({ text: "Hello" }).expect(401);
    expect(updateReview).not.toHaveBeenCalled();
  });
  it("publishes a trimmed public reply for the reviewed Tutor", async () => {
    const response = await submit().expect(201);
    expect(response.body.reply).toEqual({ text: "Thank you!", repliedAt: expect.any(String) });
    expect(updateReview).toHaveBeenCalledWith({
      where: { id, removedAt: null, replyText: null, subject: { tutorId } },
      data: { replyText: "Thank you!", repliedAt: expect.any(Date) },
    });
  });
  it("rejects Students and applicants", async () => {
    findUser.mockResolvedValue({ tutorId: null });
    await submit().expect(403);
    expect(findReview).not.toHaveBeenCalled();
    expect(updateReview).not.toHaveBeenCalled();
  });
  it("rejects another Tutor", async () => {
    findReview.mockResolvedValue({ replyText: null, subject: { tutorId: "another-tutor" } });
    await submit().expect(403);
    expect(updateReview).not.toHaveBeenCalled();
  });
  it("reports a deleted review", async () => {
    findReview.mockResolvedValue(null);
    const response = await submit().expect(404);
    expect(response.body).toEqual({
      code: "REVIEW_NOT_FOUND",
      message: "This review no longer exists.",
    });
  });
  it("reports deletion between read and publish", async () => {
    updateReview.mockResolvedValue({ count: 0 });
    findReview
      .mockResolvedValueOnce({ replyText: null, subject: { tutorId } })
      .mockResolvedValueOnce(null);
    const response = await submit().expect(404);
    expect(response.body.code).toBe("REVIEW_NOT_FOUND");
  });
  it("rejects an existing reply", async () => {
    findReview.mockResolvedValue({ replyText: "Already replied", subject: { tutorId } });
    await submit().expect(409);
    expect(updateReview).not.toHaveBeenCalled();
  });
  it("rejects a concurrent reply instead of overwriting it", async () => {
    updateReview.mockResolvedValue({ count: 0 });
    const response = await submit().expect(409);
    expect(response.body.code).toBe("REVIEW_ALREADY_REPLIED");
  });
  it.each([{}, { text: "  " }, { text: 1 }, { text: "x".repeat(2001) }])(
    "rejects invalid text %j",
    async (body) => {
      await submit(body).expect(400);
      expect(updateReview).not.toHaveBeenCalled();
    }
  );
  it("rejects invalid review IDs before querying", async () => {
    await submit({ text: "Thanks" }, "not-a-uuid").expect(400);
    expect(findUser).not.toHaveBeenCalled();
  });
});
