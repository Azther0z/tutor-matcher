import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const tutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const tutorFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const subjectFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const reviewGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
const bookingGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
const learningAreaFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: tutorFindUnique },
    tutor: { findMany: tutorFindMany },
    subject: { findMany: subjectFindMany },
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
  firstName: string;
  rates: string[];
  reviews?: number[];
  taught?: number;
};

function tutorRow({ id, firstName, rates }: Fixture) {
  return {
    id,
    user: { firstName, lastName: "Tutor" },
    currentProfileVersion: { bio: `${firstName} teaches maths.` },
    subjects: rates.map((rate, index) => ({
      id: `${id}-subject-${index}`,
      name: `${firstName} subject ${index}`,
      description: "Description",
      hourlyRate: new Prisma.Decimal(rate),
      format: "ONLINE",
      learningAreas: [{ learningArea: MATHEMATICS }],
    })),
  };
}

// Mirrors Prisma: one row per subject, grouped as the service asks for them.
function useTutors(fixtures: Fixture[]) {
  tutorFindMany.mockResolvedValue(fixtures.map(tutorRow));
  subjectFindMany.mockResolvedValue(
    fixtures.map(({ id }) => ({ id: `${id}-subject-0`, tutorId: id }))
  );
  reviewGroupBy.mockResolvedValue(
    fixtures
      .filter(({ reviews }) => reviews?.length)
      .map(({ id, reviews }) => ({
        subjectId: `${id}-subject-0`,
        _sum: { ratingStars: reviews!.reduce((sum, stars) => sum + stars, 0) },
        _count: { _all: reviews!.length },
      }))
  );
  bookingGroupBy.mockResolvedValue(
    fixtures
      .filter(({ taught }) => taught)
      .map(({ id, taught }) => ({ subjectId: `${id}-subject-0`, _count: { _all: taught } }))
  );
}

const tutorIds = (body: { tutors: { firstName: string }[] }) =>
  body.tutors.map(({ firstName }) => firstName);

describe("DISC-1 tutor search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTutors([
      { id: "a", firstName: "Anong", rates: ["500.00"], reviews: [5, 4], taught: 1 },
      { id: "b", firstName: "Daniel", rates: ["300.00", "900.00"], reviews: [3] },
      { id: "c", firstName: "Sirinya", rates: ["750.00"], taught: 4 },
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
    expect(tutorFindMany).not.toHaveBeenCalled();
  });

  it("applies area, price and format to the same subject and every keyword word", async () => {
    await request(app)
      .get("/api/discovery/tutors")
      .query({
        q: "  anong   calculus ",
        learningAreaId: MATHEMATICS.id,
        maxPrice: "600",
        format: "ONLINE",
        minRating: "",
      })
      .expect(200);

    const subjectWhere = {
      learningAreas: { some: { learningAreaId: MATHEMATICS.id } },
      hourlyRate: { lte: 600 },
      format: "ONLINE",
    };
    const args = tutorFindMany.mock.calls[0][0] as {
      where: Record<string, unknown> & { AND: unknown[] };
      select: { subjects: { where: unknown } };
    };
    expect(args.where).toMatchObject({
      status: "PUBLISHED",
      user: { isNot: null },
      currentProfileVersion: { status: "APPROVED" },
      subjects: { some: subjectWhere },
    });
    expect(args.where.AND).toHaveLength(2);
    expect(JSON.stringify(args.where.AND[1])).toContain('"contains":"calculus"');
    // The card lists only the subjects that passed the filters.
    expect(args.select.subjects.where).toEqual(subjectWhere);
  });

  it("returns public listing data with rating, classes taught and the cheapest matching rate", async () => {
    const response = await request(app).get("/api/discovery/tutors").expect(200);
    const daniel = response.body.tutors.find(
      ({ firstName }: { firstName: string }) => firstName === "Daniel"
    );
    expect(daniel).toEqual({
      id: "b",
      firstName: "Daniel",
      lastName: "Tutor",
      bio: "Daniel teaches maths.",
      verified: true,
      rating: 3,
      reviewCount: 1,
      classesTaught: 0,
      fromHourlyRate: "300.00",
      subjects: [
        expect.objectContaining({ hourlyRate: "300.00", learningAreas: [MATHEMATICS] }),
        expect.objectContaining({ hourlyRate: "900.00" }),
      ],
    });
    expect(response.body.tutors[0]).toMatchObject({ firstName: "Sirinya", rating: null });
    expect(JSON.stringify(response.body)).not.toContain("identificationCard");
  });

  it.each([
    ["recommended", ["Sirinya", "Anong", "Daniel"]],
    ["rating", ["Anong", "Daniel", "Sirinya"]],
    ["price_asc", ["Daniel", "Anong", "Sirinya"]],
    ["price_desc", ["Sirinya", "Anong", "Daniel"]],
  ])("sorts by %s", async (sort, order) => {
    const response = await request(app).get("/api/discovery/tutors").query({ sort }).expect(200);
    expect(tutorIds(response.body)).toEqual(order);
  });

  it("drops unrated and lower-rated tutors once a minimum rating is set", async () => {
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ minRating: "4" })
      .expect(200);
    expect(tutorIds(response.body)).toEqual(["Anong"]);
    expect(response.body.tutors[0].rating).toBe(4.5);
    expect(response.body.total).toBe(1);
  });

  it("paginates after filtering and sorting", async () => {
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ sort: "price_asc", page: "2", pageSize: "2" })
      .expect(200);
    expect(tutorIds(response.body)).toEqual(["Sirinya"]);
    expect(response.body).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
  });

  it("returns an empty page without counting stats when nothing matches", async () => {
    useTutors([]);
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ q: "nobody" })
      .expect(200);
    expect(response.body).toEqual({ tutors: [], page: 1, pageSize: 12, total: 0, totalPages: 1 });
    expect(reviewGroupBy).not.toHaveBeenCalled();
  });

  it("counts a class as taught when completed, or confirmed and already over", async () => {
    const now = Date.now();
    await request(app).get("/api/discovery/tutors").expect(200);
    const args = bookingGroupBy.mock.calls[0][0] as {
      where: { OR: [unknown, { endedAt: { lte: Date } }] };
    };
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
