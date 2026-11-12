import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";

if (process.env.RUN_DATABASE_INTEGRATION === "true") {
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (
    database.hostname !== "127.0.0.1" ||
    database.port !== "55436" ||
    database.username !== "rev3" ||
    database.pathname !== "/tutor_matcher_rev3_test"
  ) {
    throw new Error(
      "REV-3 integration tests require tutor_matcher_rev3_test as rev3 on 127.0.0.1:55436"
    );
  }
}
const describeDatabase = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;

const token = `rev3${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
let tutorId: string;
let subjectId: string;
let author: { id: string; email: string };
let flagger: { id: string; email: string };
let bystander: { id: string; email: string };
let reviewId: string;
let silentReviewId: string;
let refundedReviewId: string;

async function createUser(firstName: string) {
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName: "Fixture",
      email: `${token}-${firstName.toLowerCase()}@example.com`,
      password: "fixture",
    },
  });
  userIds.push(user.id);
  return user;
}

async function reviewedLesson(
  status: "COMPLETED" | "CANCELLED",
  text: string | null
): Promise<string> {
  const startedAt = new Date(Date.now() - 2 * 60 * 60_000);
  const booking = await prisma.booking.create({
    data: {
      userId: author.id,
      subjectId,
      status,
      totalAmount: "100.00",
      startedAt,
      endedAt: new Date(startedAt.getTime() + 30 * 60_000),
    },
  });
  const review = await prisma.review.create({
    data: { ratingStars: 1, text, userId: author.id, subjectId, bookingId: booking.id },
  });
  return review.id;
}

const as = (user: { id: string; email: string }) =>
  `Bearer ${signAuthToken({ sub: user.id, email: user.email, isAdmin: false })}`;
const flag = (user: { id: string; email: string }, id: string, reason = "Abusive language") =>
  request(app).post(`/api/reviews/${id}/flags`).set("Authorization", as(user)).send({ reason });
const profile = (user?: { id: string; email: string }) => {
  const call = request(app).get(`/api/discovery/tutors/${tutorId}/profile`);
  return (user ? call.set("Authorization", as(user)) : call).expect(200);
};
const reviewOf = (body: { reviews: Array<{ id: string }> }) =>
  body.reviews.find(({ id }) => id === reviewId) as {
    flaggedByMe?: boolean;
    isMine?: boolean;
  };

describeDatabase("REV-3 review flags on PostgreSQL", () => {
  beforeAll(async () => {
    author = await createUser("Author");
    flagger = await createUser("Flagger");
    bystander = await createUser("Bystander");
    const tutorUser = await createUser("Tutor");
    const tutor = await prisma.tutor.create({
      data: {
        status: "PUBLISHED",
        currentProfileVersion: {
          create: { userId: tutorUser.id, status: "APPROVED", bio: `Bio ${token}` },
        },
      },
    });
    tutorId = tutor.id;
    await prisma.user.update({ where: { id: tutorUser.id }, data: { tutorId } });
    subjectId = (
      await prisma.subject.create({
        data: { name: `Chemistry ${token}`, hourlyRate: "400.00", tutorId },
      })
    ).id;
    reviewId = await reviewedLesson("COMPLETED", "Rude comment");
    silentReviewId = await reviewedLesson("COMPLETED", null);
    refundedReviewId = await reviewedLesson("CANCELLED", "Refunded lesson comment");
  });

  afterAll(async () => {
    await prisma.reviewFlag.deleteMany({ where: { review: { subjectId } } });
    await prisma.review.deleteMany({ where: { subjectId } });
    await prisma.booking.deleteMany({ where: { subjectId } });
    await prisma.subject.deleteMany({ where: { tutorId } });
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { tutorId: null } });
    await prisma.tutor.deleteMany({ where: { id: tutorId } });
    await prisma.tutorProfileVersion.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("stores one flag per member and review, and rejects the same member's second flag", async () => {
    await flag(flagger, reviewId, "  Abusive language ").expect(201);
    const again = await flag(flagger, reviewId, "A different reason").expect(409);

    expect(again.body.code).toBe("ALREADY_FLAGGED");
    const stored = await prisma.reviewFlag.findMany({ where: { reviewId } });
    expect(stored).toEqual([
      expect.objectContaining({ reporterId: flagger.id, reason: "Abusive language" }),
    ]);
  });

  it("lets other members flag the same review, each with their own reason", async () => {
    await flag(bystander, reviewId, "Fake review").expect(201);

    const reasons = (await prisma.reviewFlag.findMany({ where: { reviewId } }))
      .map(({ reason }) => reason)
      .sort();
    expect(reasons).toEqual(["Abusive language", "Fake review"]);
  });

  it("refuses the review's author, a review without a comment and a refunded review", async () => {
    await flag(author, reviewId).expect(403);
    await flag(flagger, silentReviewId).expect(404);
    await flag(flagger, refundedReviewId).expect(404);

    expect(await prisma.reviewFlag.count({ where: { review: { subjectId } } })).toBe(2);
  });

  it("tells each viewer of the public profile what they flagged and what is theirs", async () => {
    expect(reviewOf((await profile(flagger)).body)).toEqual(
      expect.objectContaining({ flaggedByMe: true, isMine: false })
    );
    expect(reviewOf((await profile(author)).body)).toEqual(
      expect.objectContaining({ flaggedByMe: false, isMine: true })
    );
    const visitor = reviewOf((await profile()).body);
    expect(visitor).not.toHaveProperty("flaggedByMe");
    expect(visitor).not.toHaveProperty("isMine");
  });

  it("keeps a flagged review public until an Admin decides", async () => {
    const body = (await profile()).body;

    expect(body.reviews.map(({ id }: { id: string }) => id)).toContain(reviewId);
    expect(body.reviewCount).toBe(2);
  });
});
