import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
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
    database.port !== "55438" ||
    database.username !== "rev4" ||
    database.pathname !== "/tutor_matcher_rev4_test"
  ) {
    throw new Error(
      "REV-4 integration tests require tutor_matcher_rev4_test as rev4 on 127.0.0.1:55438"
    );
  }
}
const describeDatabase = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;

type Person = { id: string; email: string; isAdmin: boolean };
const token = `rev4${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
let tutorId: string;
let subjectId: string;
let author: Person;
let admin: Person;
const members: Person[] = [];

async function createUser(firstName: string, isAdmin = false): Promise<Person> {
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName: "Fixture",
      email: `${token}-${firstName.toLowerCase()}@example.com`,
      password: "fixture",
      isAdmin,
    },
  });
  userIds.push(user.id);
  return { id: user.id, email: user.email, isAdmin };
}

async function reviewedLesson(ratingStars: number, text: string) {
  const startedAt = new Date(Date.now() - 2 * 60 * 60_000);
  const booking = await prisma.booking.create({
    data: {
      userId: author.id,
      subjectId,
      status: "COMPLETED",
      totalAmount: "100.00",
      startedAt,
      endedAt: new Date(startedAt.getTime() + 30 * 60_000),
    },
  });
  const review = await prisma.review.create({
    data: { ratingStars, text, userId: author.id, subjectId, bookingId: booking.id },
  });
  return { bookingId: booking.id, reviewId: review.id };
}

const bearer = (person: Person) =>
  `Bearer ${signAuthToken({ sub: person.id, email: person.email, isAdmin: person.isAdmin })}`;
const flag = (member: Person, reviewId: string) =>
  request(app)
    .post(`/api/reviews/${reviewId}/flags`)
    .set("Authorization", bearer(member))
    .send({ reason: `Flag from ${member.email}` });
const decide = (reviewId: string, body: object) =>
  request(app)
    .post(`/api/admin/reviews/${reviewId}/moderation`)
    .set("Authorization", bearer(admin))
    .send(body);
const queue = async (status: "PENDING" | "DECIDED") =>
  (
    await request(app)
      .get(`/api/admin/review-flags?status=${status}`)
      .set("Authorization", bearer(admin))
      .expect(200)
  ).body as Array<{ id: string; pendingFlags: number }>;
const profile = async () =>
  (await request(app).get(`/api/discovery/tutors/${tutorId}/profile`).expect(200)).body as {
    rating: number | null;
    reviewCount: number;
    reviews: Array<{ id: string }>;
  };

describeDatabase("REV-4 review moderation on PostgreSQL", () => {
  let kept: { bookingId: string; reviewId: string };
  let removed: { bookingId: string; reviewId: string };

  beforeAll(async () => {
    author = await createUser("Author");
    admin = await createUser("Admin", true);
    for (const name of ["One", "Two", "Three"]) members.push(await createUser(`Member${name}`));
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
        data: {
          name: `Chemistry ${token}`,
          description: `Chemistry lessons ${token}`,
          hourlyRate: "400.00",
          tutorId,
        },
      })
    ).id;
    kept = await reviewedLesson(5, "Great explanations");
    removed = await reviewedLesson(1, "Abusive comment");
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
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

  it("keeps a flagged review public, then re-queues it when another member flags it", async () => {
    await flag(members[0], kept.reviewId).expect(201);
    await flag(members[1], kept.reviewId).expect(201);
    expect((await queue("PENDING")).find(({ id }) => id === kept.reviewId)?.pendingFlags).toBe(2);

    await decide(kept.reviewId, { decision: "KEEP" }).expect(200);

    expect((await queue("PENDING")).map(({ id }) => id)).not.toContain(kept.reviewId);
    expect((await queue("DECIDED")).map(({ id }) => id)).toContain(kept.reviewId);
    expect((await profile()).reviews.map(({ id }) => id)).toContain(kept.reviewId);
    const outcomes = await prisma.reviewFlag.findMany({ where: { reviewId: kept.reviewId } });
    expect(outcomes.map(({ outcome, decidedById }) => [outcome, decidedById])).toEqual([
      ["KEPT", admin.id],
      ["KEPT", admin.id],
    ]);

    // The same member can never flag it again; a new member puts it back in the queue.
    await flag(members[0], kept.reviewId).expect(409);
    await flag(members[2], kept.reviewId).expect(201);
    expect((await queue("PENDING")).find(({ id }) => id === kept.reviewId)?.pendingFlags).toBe(1);
  });

  it("removes the whole review from lists, averages and ranking, and tells the author why", async () => {
    // The 1-star review pulls the average to 3 until it is removed.
    const ranked = () =>
      request(app)
        .get("/api/discovery/tutors")
        .query({ q: token, minRating: "4" })
        .expect(200)
        .then(({ body }) => (body.results as Array<{ id: string }>).length);
    expect((await profile()).rating).toBe(3);
    expect(await ranked()).toBe(0);

    await flag(members[0], removed.reviewId).expect(201);
    await decide(removed.reviewId, { decision: "REMOVE", reason: "Harassment" }).expect(200);

    const after = await profile();
    expect(after.reviews.map(({ id }) => id)).not.toContain(removed.reviewId);
    expect(after.reviewCount).toBe(1);
    expect(after.rating).toBe(5);
    const subjectPage = await request(app)
      .get(`/api/discovery/tutors/${tutorId}/subjects/${subjectId}`)
      .expect(200);
    expect(subjectPage.body.reviews.map(({ id }: { id: string }) => id)).not.toContain(
      removed.reviewId
    );
    expect(await ranked()).toBe(1);

    // Nobody can flag or decide on it again; the author sees why it was removed.
    await flag(members[1], removed.reviewId).expect(404);
    await decide(removed.reviewId, { decision: "KEEP" }).expect(409);
    const booking = await request(app)
      .get(`/api/bookings/${removed.bookingId}`)
      .set("Authorization", bearer(author))
      .expect(200);
    expect(booking.body.booking.review).toMatchObject({
      comment: null,
      removed: { reason: "Harassment" },
    });
    expect(booking.body.booking.actions.canReview).toBe(false);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(`[notification:review] ${author.email}:`)
    );
  });

  it("settles two simultaneous decisions as one decision and one conflict", async () => {
    const contested = await reviewedLesson(4, "Contested comment");
    await flag(members[0], contested.reviewId).expect(201);

    const statuses = (
      await Promise.all([
        decide(contested.reviewId, { decision: "KEEP" }),
        decide(contested.reviewId, { decision: "REMOVE", reason: "Spam" }),
      ])
    )
      .map(({ status }) => status)
      .sort();

    expect(statuses).toEqual([200, 409]);
    const flags = await prisma.reviewFlag.findMany({ where: { reviewId: contested.reviewId } });
    expect(flags).toHaveLength(1);
    expect(flags[0].outcome).not.toBeNull();
  });
});
