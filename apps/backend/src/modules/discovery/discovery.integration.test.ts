import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";
import { searchTutorSubjects } from "./discovery.service.ts";
import { tutorSearchQuerySchema } from "./discovery.schema.ts";

if (process.env.RUN_DATABASE_INTEGRATION === "true") {
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (
    database.hostname !== "127.0.0.1" ||
    database.port !== "55434" ||
    database.username !== "auth4" ||
    database.pathname !== "/auth4_test"
  ) {
    throw new Error(
      "DISC-1 integration tests require the isolated auth4 test database on 127.0.0.1:55434"
    );
  }
}
const describeDatabase = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;

// Every fixture subject description carries this token, so searches ignore other rows.
const token = `disc1${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const tutorIds: string[] = [];
const studentIds: string[] = [];
const areas: Record<string, string> = {};
let searchNow: Date;

async function createTutor(
  firstName: string,
  subjects: { name: string; rate: string; areas: string[] }[],
  status: "PUBLISHED" | "UNPUBLISHED" = "PUBLISHED"
) {
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName: "Fixture",
      email: `${token}-${firstName.toLowerCase()}@example.com`,
      password: "fixture",
    },
  });
  userIds.push(user.id);
  const tutor = await prisma.tutor.create({
    data: {
      status,
      currentProfileVersion: {
        create: { userId: user.id, status: "APPROVED", bio: `${firstName} ${token}` },
      },
    },
  });
  tutorIds.push(tutor.id);
  await prisma.user.update({ where: { id: user.id }, data: { tutorId: tutor.id } });
  const created = [];
  for (const subject of subjects) {
    created.push(
      await prisma.subject.create({
        data: {
          name: subject.name,
          description: `${subject.name} lessons ${token}`,
          hourlyRate: subject.rate,
          tutorId: tutor.id,
          learningAreas: {
            create: subject.areas.map((name) => ({ learningAreaId: areas[name] })),
          },
        },
      })
    );
  }
  return { tutor, subjects: created };
}

async function lesson(subjectId: string, studentId: string, status: "COMPLETED" | "CONFIRMED") {
  const startedAt = new Date(Date.now() - 2 * 60 * 60_000);
  return prisma.booking.create({
    data: {
      userId: studentId,
      subjectId,
      status,
      totalAmount: "100.00",
      startedAt,
      endedAt: new Date(startedAt.getTime() + 30 * 60_000),
    },
  });
}

function search(query: Record<string, string>) {
  return request(app)
    .get("/api/discovery/tutors")
    .query({ ...query, q: `${token} ${query.q ?? ""}` })
    .expect(200);
}
function personalizedSearch(query: Record<string, string> = {}) {
  const studentId = studentIds[0];
  return request(app)
    .get("/api/discovery/tutors")
    .set(
      "Authorization",
      `Bearer ${signAuthToken({ sub: studentId, email: `${token}-student@example.com`, isAdmin: false })}`
    )
    .query({ ...query, q: `${token} ${query.q ?? ""}` })
    .expect(200);
}

async function publishAvailability(
  tutorId: string,
  subjectId: string,
  startedAt: Date,
  isOpen = true,
  bookingId: string | null = null
) {
  await prisma.availability.create({
    data: {
      tutorId,
      startedAt,
      isOpen,
      bookingId,
      availabilitySubjects: { create: [{ subjectId }] },
    },
  });
}
const names = (body: { results: { name: string }[] }) => body.results.map(({ name }) => name);

describeDatabase("DISC-1 search on PostgreSQL", () => {
  beforeAll(async () => {
    for (const name of ["Mathematics", "Physics", "English"]) {
      const area = await prisma.learningArea.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      areas[name] = area.id;
    }
    const student = await prisma.user.create({
      data: {
        firstName: "Student",
        lastName: "Fixture",
        email: `${token}-student@example.com`,
        password: "fixture",
      },
    });
    userIds.push(student.id);
    studentIds.push(student.id);
    await prisma.student.create({
      data: {
        userId: student.id,
        educationLevel: "UNIVERSITY",
        goals: ["EXAM_PREPARATION"],
        preferredLearningPeriod: "FLEXIBLE",
        preferredDurationMinutes: 30,
        learningAreas: { create: [{ learningAreaId: areas.Mathematics }] },
      },
    });

    const anong = await createTutor("Anong", [
      { name: "แคลคูลัส ม.ปลาย", rate: "500.00", areas: ["Mathematics"] },
    ]);
    const daniel = await createTutor("Daniel", [
      { name: "SAT Physics", rate: "900.00", areas: ["Physics", "Mathematics"] },
      { name: "IELTS Speaking", rate: "300.00", areas: ["English"] },
    ]);
    const sirinya = await createTutor("Sirinya", [
      { name: "Algebra", rate: "750.00", areas: ["Mathematics"] },
    ]);
    await createTutor(
      "Hidden",
      [{ name: "Algebra", rate: "100.00", areas: ["Mathematics"] }],
      "UNPUBLISHED"
    );

    searchNow = new Date();
    const now = searchNow.getTime();
    await publishAvailability(
      anong.tutor.id,
      anong.subjects[0].id,
      new Date(now + 5 * 24 * 60 * 60_000)
    );
    await publishAvailability(
      daniel.tutor.id,
      daniel.subjects[0].id,
      new Date(now + 2 * 60 * 60_000)
    );

    const reviewed = await lesson(anong.subjects[0].id, student.id, "COMPLETED");
    await prisma.review.createMany({
      data: [5, 4].map((ratingStars) => ({
        ratingStars,
        userId: student.id,
        subjectId: anong.subjects[0].id,
        bookingId: reviewed.id,
      })),
    });
    for (let i = 0; i < 3; i++) await lesson(sirinya.subjects[0].id, student.id, "CONFIRMED");
    const algebra = sirinya.subjects[0];
    await publishAvailability(sirinya.tutor.id, algebra.id, new Date(now + 60 * 60_000), false);
    await publishAvailability(sirinya.tutor.id, algebra.id, new Date(now - 60 * 60_000));
    await publishAvailability(
      sirinya.tutor.id,
      algebra.id,
      new Date(now + 90 * 60_000),
      true,
      reviewed.id
    );
    await publishAvailability(sirinya.tutor.id, algebra.id, new Date(now + 31 * 24 * 60 * 60_000));
    const ielts = daniel.subjects[1];
    await publishAvailability(daniel.tutor.id, ielts.id, new Date(now + 30 * 24 * 60 * 60_000));
    await publishAvailability(daniel.tutor.id, ielts.id, new Date(now + 31 * 24 * 60 * 60_000));
  });

  afterAll(async () => {
    await prisma.availabilitySubject.deleteMany({
      where: { availability: { tutorId: { in: tutorIds } } },
    });
    await prisma.availability.deleteMany({ where: { tutorId: { in: tutorIds } } });
    await prisma.review.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.booking.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.subject.deleteMany({ where: { tutorId: { in: tutorIds } } });
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { tutorId: null } });
    await prisma.tutor.deleteMany({ where: { id: { in: tutorIds } } });
    await prisma.tutorProfileVersion.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("matches subjects by tutor name or subject in any case, including Thai", async () => {
    expect(names((await search({ tutorName: "ANONG" })).body)).toEqual(["แคลคูลัส ม.ปลาย"]);
    expect(names((await search({ q: "แคลคูลัส" })).body)).toEqual(["แคลคูลัส ม.ปลาย"]);
    expect(names((await search({ q: "algebra" })).body)).toEqual(["Algebra"]);
    // One card per subject, so a tutor with two subjects shows twice.
    expect(names((await search({ tutorName: "daniel" })).body)).toEqual([
      "IELTS Speaking",
      "SAT Physics",
    ]);
    // The keyword no longer matches tutor names.
    expect(names((await search({ q: "daniel" })).body)).toEqual([]);
  });

  it("filters each subject by its own areas, price and format", async () => {
    const physicsUnder500 = await search({ learningAreaId: areas.Physics, maxPrice: "500" });
    expect(names(physicsUnder500.body)).toEqual([]);

    const mathematics = await search({ learningAreaId: areas.Mathematics, format: "ONLINE" });
    expect(names(mathematics.body).sort()).toEqual(["Algebra", "SAT Physics", "แคลคูลัส ม.ปลาย"]);
    const physics = mathematics.body.results.find(
      ({ name }: { name: string }) => name === "SAT Physics"
    );
    expect(physics).toMatchObject({
      hourlyRate: "900.00",
      tutor: { firstName: "Daniel" },
      learningAreas: expect.arrayContaining([
        expect.objectContaining({ name: "Physics" }),
        expect.objectContaining({ name: "Mathematics" }),
      ]),
    });
  });

  it("ranks anonymous results by rating and next availability, while retaining other sorts", async () => {
    const recommended = await search({});
    expect(names(recommended.body)).toEqual([
      "แคลคูลัส ม.ปลาย",
      "SAT Physics",
      "Algebra",
      "IELTS Speaking",
    ]);
    expect(recommended.body.recommendationMode).toBe("fallback");
    expect(recommended.body.results[2].classesTaught).toBe(3);
    expect(recommended.body.results[1]).toMatchObject({
      rating: 4.5,
      reviewCount: 2,
      classesTaught: 1,
    });
    expect(recommended.body.results[0].nextAvailableAt).toEqual(expect.any(String));

    expect(names((await search({ minRating: "4.5" })).body)).toEqual(["แคลคูลัส ม.ปลาย"]);
    expect(names((await search({ sort: "price_asc" })).body)).toEqual([
      "IELTS Speaking",
      "แคลคูลัส ม.ปลาย",
      "Algebra",
      "SAT Physics",
    ]);
  });

  it("personalizes by the Student's learning areas and reports the next slot for each Subject", async () => {
    const response = await personalizedSearch();
    expect(response.body.recommendationMode).toBe("personalized");
    expect(names(response.body)).toEqual([
      "แคลคูลัส ม.ปลาย",
      "SAT Physics",
      "Algebra",
      "IELTS Speaking",
    ]);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.results[0].nextAvailableAt).toEqual(expect.any(String));
    expect(response.body.results[1].nextAvailableAt).toEqual(expect.any(String));
    expect(response.body.results[2].nextAvailableAt).toBeNull();
  });

  it("uses one fixed request time and includes the exact 30-day boundary only", async () => {
    const response = await searchTutorSubjects(
      tutorSearchQuerySchema.parse({ q: token }),
      searchNow,
      studentIds[0]
    );
    const ielts = response.results.find(({ name }) => name === "IELTS Speaking");
    const algebra = response.results.find(({ name }) => name === "Algebra");

    expect(ielts?.nextAvailableAt).toBe(
      new Date(searchNow.getTime() + 30 * 24 * 60 * 60_000).toISOString()
    );
    expect(algebra?.nextAvailableAt).toBeNull();
  });

  it("pages in the database and reports the total of every match", async () => {
    const second = await search({ sort: "price_asc", pageSize: "2", page: "2" });
    expect(names(second.body)).toEqual(["Algebra", "SAT Physics"]);
    expect(second.body).toMatchObject({ page: 2, pageSize: 2, total: 4, totalPages: 2 });

    // A page past the end has no results but still says how many there are.
    const beyond = await search({ pageSize: "2", page: "9" });
    expect(beyond.body).toMatchObject({ results: [], total: 4, totalPages: 2 });
  });

  it("matches % and _ typed in the keyword literally", async () => {
    expect(names((await search({ q: "%" })).body)).toEqual([]);
    expect(names((await search({ q: "_" })).body)).toEqual([]);
  });

  it("returns the price range of listed subjects from its own endpoint", async () => {
    const response = await request(app).get("/api/discovery/price-range").expect(200);
    expect(Number(response.body.priceRange.min)).toBeLessThanOrEqual(300);
    expect(Number(response.body.priceRange.max)).toBeGreaterThanOrEqual(900);
  });

  it("never lists an unpublished tutor's subjects and returns an empty page when nothing matches", async () => {
    expect(names((await search({ tutorName: "hidden" })).body)).toEqual([]);
    const between = await search({ minPrice: "400", maxPrice: "800" });
    expect(names(between.body).sort()).toEqual(["Algebra", "แคลคูลัส ม.ปลาย"]);
    const none = await search({ maxPrice: "50" });
    expect(none.body).toMatchObject({ results: [], total: 0, totalPages: 1 });
  });
});
