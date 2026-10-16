import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const tutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const subjectFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const subjectAggregate = jest.fn<(args: unknown) => Promise<unknown>>();
const reviewGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
const bookingGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
const learningAreaFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: tutorFindUnique },
    subject: { findMany: subjectFindMany, aggregate: subjectAggregate },
    review: { groupBy: reviewGroupBy },
    booking: { groupBy: bookingGroupBy },
    learningArea: { findMany: learningAreaFindMany },
  },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const { Prisma } = await import("../../generated/prisma/client.ts");

const TUTOR_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "00000000-0000-4000-8000-000000000020";

function tokenFor(userId = USER_ID) {
  return signAuthToken({ sub: userId, email: "student@example.com", isAdmin: false });
}

describe("Discovery API", () => {
  beforeEach(() => {
    tutorFindUnique.mockReset();
  });

  it("requires authentication", async () => {
    await request(app).get(`/api/discovery/tutors/${TUTOR_ID}`).expect(401);
    expect(tutorFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for an invalid tutor id", async () => {
    await request(app)
      .get("/api/discovery/tutors/not-a-uuid")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(404);

    expect(tutorFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the tutor does not exist", async () => {
    tutorFindUnique.mockResolvedValue(null);

    await request(app)
      .get(`/api/discovery/tutors/${TUTOR_ID}`)
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(404);
  });

  it("returns the tutor's public identity", async () => {
    tutorFindUnique.mockResolvedValue({
      id: USER_ID,
      firstName: "Anong",
      lastName: "P.",
      tutor: {
        id: TUTOR_ID,
        status: "PUBLISHED",
        currentProfileVersion: {
          status: "APPROVED",
          bio: "Approved bio",
          avatarUrl: null,
          introVideoUrl: null,
          identificationCardUrl: "https://example.com/private-id",
          certifications: [
            { fileUrl: "https://example.com/public-contest" },
            { fileUrl: "https://example.com/public-second-contest" },
          ],
        },
      },
    });

    const response = await request(app)
      .get(`/api/discovery/tutors/${TUTOR_ID}`)
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(200);

    expect(tutorFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tutorId: TUTOR_ID } })
    );
    expect(response.body).toEqual({
      id: TUTOR_ID,
      userId: USER_ID,
      firstName: "Anong",
      lastName: "P.",
      status: "PUBLISHED",
      verified: true,
      bio: "Approved bio",
      avatarUrl: null,
      introVideoUrl: null,
      certificationUrls: [
        "https://example.com/public-contest",
        "https://example.com/public-second-contest",
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain("identificationCardUrl");
    expect(JSON.stringify(response.body)).not.toContain("private-");
  });
  it.each(["DRAFT", "PENDING", "REJECTED", "CANCELLED"])(
    "never exposes a %s portfolio even if the current pointer is malformed",
    async (status) => {
      tutorFindUnique.mockResolvedValue({
        id: USER_ID,
        firstName: "Anong",
        lastName: "P.",
        tutor: {
          id: TUTOR_ID,
          status: "UNPUBLISHED",
          currentProfileVersion: {
            status,
            bio: null,
            avatarUrl: null,
            introVideoUrl: null,
            certifications: [{ fileUrl: "https://example.com/not-approved" }],
          },
        },
      });
      const response = await request(app)
        .get(`/api/discovery/tutors/${TUTOR_ID}`)
        .set("Authorization", `Bearer ${tokenFor()}`)
        .expect(200);
      expect(response.body.certificationUrls).toEqual([]);
      expect(JSON.stringify(response.body)).not.toContain("not-approved");
      expect(response.body).not.toHaveProperty("currentProfileVersion");
    }
  );
});

const MATHEMATICS = { id: "00000000-0000-4000-8000-000000000101", name: "Mathematics" };
const PHYSICS = { id: "00000000-0000-4000-8000-000000000102", name: "Physics" };

type Fixture = {
  id: string;
  name: string;
  tutor: string;
  rate: string;
  reviews?: number[];
  taught?: number;
};

function subjectRow({ id, name, tutor, rate }: Fixture) {
  return {
    id,
    name,
    description: `${name} lessons`,
    hourlyRate: new Prisma.Decimal(rate),
    format: "ONLINE",
    learningAreas: [{ learningArea: MATHEMATICS }],
    tutor: {
      id: `tutor-${tutor}`,
      user: { firstName: tutor, lastName: "Tutor" },
      currentProfileVersion: { bio: `${tutor} teaches.` },
    },
  };
}

// Mirrors Prisma: stats come back one row per subject.
function useSubjects(fixtures: Fixture[]) {
  subjectFindMany.mockResolvedValue(fixtures.map(subjectRow));
  const rates = fixtures.map(({ rate }) => new Prisma.Decimal(rate));
  subjectAggregate.mockResolvedValue({
    _min: { hourlyRate: rates.length ? Prisma.Decimal.min(...rates) : null },
    _max: { hourlyRate: rates.length ? Prisma.Decimal.max(...rates) : null },
  });
  reviewGroupBy.mockResolvedValue(
    fixtures
      .filter(({ reviews }) => reviews?.length)
      .map(({ id, reviews }) => ({
        subjectId: id,
        _sum: { ratingStars: reviews!.reduce((sum, stars) => sum + stars, 0) },
        _count: { _all: reviews!.length },
      }))
  );
  bookingGroupBy.mockResolvedValue(
    fixtures
      .filter(({ taught }) => taught)
      .map(({ id, taught }) => ({ subjectId: id, _count: { _all: taught } }))
  );
}

const names = (body: { results: { name: string }[] }) => body.results.map(({ name }) => name);

describe("DISC-1 tutor search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSubjects([
      {
        id: "calculus",
        name: "Calculus",
        tutor: "Anong",
        rate: "500.00",
        reviews: [5, 4],
        taught: 1,
      },
      { id: "algebra", name: "Algebra", tutor: "Daniel", rate: "300.00", reviews: [3] },
      { id: "physics", name: "Physics", tutor: "Daniel", rate: "900.00", reviews: [5] },
      { id: "python", name: "Python", tutor: "Sirinya", rate: "750.00", taught: 4 },
    ]);
  });

  it("is public: search and learning areas need no login, the tutor page still does", async () => {
    learningAreaFindMany.mockResolvedValue([MATHEMATICS]);
    await request(app).get("/api/discovery/tutors").expect(200);
    await request(app).get("/api/discovery/learning-areas").expect(200);
    await request(app).get(`/api/discovery/tutors/${TUTOR_ID}`).expect(401);
  });

  it.each([
    ["sort", "cheapest"],
    ["maxPrice", "0"],
    ["maxPrice", "-5"],
    ["maxPrice", "abc"],
    ["minRating", "6"],
    ["minRating", "3.7"],
    ["minPrice", "-1"],
    ["learningAreaId", "maths"],
    ["format", "IN_PERSON"],
    ["page", "0"],
    ["pageSize", "51"],
    ["q", "x".repeat(101)],
  ])("rejects an invalid %s (%s) before querying", async (key, value) => {
    await request(app)
      .get("/api/discovery/tutors")
      .query({ [key]: value })
      .expect(400);
    expect(subjectFindMany).not.toHaveBeenCalled();
  });

  it("rejects a minimum price above the maximum", async () => {
    await request(app)
      .get("/api/discovery/tutors")
      .query({ minPrice: "700", maxPrice: "600" })
      .expect(400);
    expect(subjectFindMany).not.toHaveBeenCalled();
  });

  it("filters subjects of published tutors by area, price, format, keyword and tutor name", async () => {
    await request(app)
      .get("/api/discovery/tutors")
      .query({
        q: "  limits   calculus ",
        tutorName: "anong",
        learningAreaId: MATHEMATICS.id,
        minPrice: "200",
        maxPrice: "600",
        format: "ONLINE",
        minRating: "",
      })
      .expect(200);

    const args = subjectFindMany.mock.calls[0][0] as {
      where: Record<string, unknown> & { AND: unknown[] };
    };
    expect(args.where).toMatchObject({
      tutor: {
        status: "PUBLISHED",
        user: { isNot: null },
        currentProfileVersion: { status: "APPROVED" },
      },
      learningAreas: { some: { learningAreaId: MATHEMATICS.id } },
      hourlyRate: { gte: 200, lte: 600 },
      format: "ONLINE",
    });
    // Two keyword words search the subject; the name searches the tutor.
    expect(args.where.AND).toHaveLength(3);
    expect(JSON.stringify(args.where.AND[0])).toContain('"contains":"limits"');
    expect(JSON.stringify(args.where.AND[0])).not.toContain("firstName");
    expect(JSON.stringify(args.where.AND[1])).toContain('"contains":"calculus"');
    expect(JSON.stringify(args.where.AND[2])).toContain('"firstName":{"contains":"anong"');
  });

  it("returns one card per subject with that subject's own price, rating and classes taught", async () => {
    const response = await request(app).get("/api/discovery/tutors").expect(200);
    expect(response.body.total).toBe(4);
    const physics = response.body.results.find(({ id }: { id: string }) => id === "physics");
    expect(physics).toEqual({
      id: "physics",
      name: "Physics",
      description: "Physics lessons",
      hourlyRate: "900.00",
      format: "ONLINE",
      learningAreas: [MATHEMATICS],
      rating: 5,
      reviewCount: 1,
      classesTaught: 0,
      tutor: {
        id: "tutor-Daniel",
        firstName: "Daniel",
        lastName: "Tutor",
        bio: "Daniel teaches.",
        verified: true,
      },
    });
    // Daniel's two subjects are rated on their own, not averaged together.
    const algebra = response.body.results.find(({ id }: { id: string }) => id === "algebra");
    expect(algebra.rating).toBe(3);
    expect(JSON.stringify(response.body)).not.toContain("identificationCard");
  });

  it.each([
    ["recommended", ["Python", "Calculus", "Physics", "Algebra"]],
    ["rating", ["Physics", "Calculus", "Algebra", "Python"]],
    ["price_asc", ["Algebra", "Calculus", "Python", "Physics"]],
    ["price_desc", ["Physics", "Python", "Calculus", "Algebra"]],
  ])("sorts subjects by %s", async (sort, order) => {
    const response = await request(app).get("/api/discovery/tutors").query({ sort }).expect(200);
    expect(names(response.body)).toEqual(order);
  });

  it("returns the price range of every listed subject, whatever the filters", async () => {
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ maxPrice: "400" })
      .expect(200);
    expect(response.body.priceRange).toEqual({ min: "300.00", max: "900.00" });
    const args = subjectAggregate.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).not.toHaveProperty("hourlyRate");
  });

  it("accepts half-star minimum ratings", async () => {
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ minRating: "4.5" })
      .expect(200);
    expect(names(response.body)).toEqual(["Calculus", "Physics"]);
  });

  it("drops unrated and lower-rated subjects once a minimum rating is set", async () => {
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ minRating: "4" })
      .expect(200);
    expect(names(response.body)).toEqual(["Calculus", "Physics"]);
    expect(response.body.results[0].rating).toBe(4.5);
    expect(response.body.total).toBe(2);
  });

  it("counts and paginates subjects after filtering and sorting", async () => {
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ sort: "price_asc", page: "2", pageSize: "3" })
      .expect(200);
    expect(names(response.body)).toEqual(["Physics"]);
    expect(response.body).toMatchObject({ page: 2, pageSize: 3, total: 4, totalPages: 2 });
  });

  it("returns an empty page without counting stats when nothing matches", async () => {
    useSubjects([]);
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ q: "nobody" })
      .expect(200);
    expect(response.body).toEqual({
      results: [],
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 1,
      priceRange: null,
    });
    expect(reviewGroupBy).not.toHaveBeenCalled();
  });

  it("counts a class as taught when completed, or confirmed and already over", async () => {
    const now = Date.now();
    await request(app).get("/api/discovery/tutors").expect(200);
    const args = bookingGroupBy.mock.calls[0][0] as {
      where: { subjectId: { in: string[] }; OR: [unknown, { endedAt: { lte: Date } }] };
    };
    expect(args.where.subjectId.in).toEqual(["calculus", "algebra", "physics", "python"]);
    expect(args.where.OR[0]).toEqual({ status: "COMPLETED" });
    expect(args.where.OR[1]).toMatchObject({ status: "CONFIRMED" });
    expect(args.where.OR[1].endedAt.lte.getTime()).toBeGreaterThanOrEqual(now);
  });

  it("lists learning areas alphabetically with Other last", async () => {
    learningAreaFindMany.mockResolvedValue([MATHEMATICS, { id: "other", name: "Other" }, PHYSICS]);
    const response = await request(app).get("/api/discovery/learning-areas").expect(200);
    expect(response.body.learningAreas.map(({ name }: { name: string }) => name)).toEqual([
      "Mathematics",
      "Physics",
      "Other",
    ]);
  });
});
