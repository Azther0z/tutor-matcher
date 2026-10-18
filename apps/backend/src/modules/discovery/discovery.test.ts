import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const tutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const subjectFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const queryRaw =
  jest.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>>();
const learningAreaFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const profileTutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const reviewAggregate = jest.fn<(args: unknown) => Promise<unknown>>();
const reviewFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const reviewGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
const availabilityFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
// Assert that public profile reads never invoke booking cleanup or its write transaction.
const bookingFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const transaction = jest.fn(async (run: (tx: unknown) => unknown) =>
  run({ booking: { findMany: bookingFindMany } })
);
const studentFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: tutorFindUnique },
    subject: { findMany: subjectFindMany },
    $queryRaw: queryRaw,
    $transaction: transaction,
    learningArea: { findMany: learningAreaFindMany },
    tutor: { findUnique: profileTutorFindUnique },
    review: { aggregate: reviewAggregate, findMany: reviewFindMany, groupBy: reviewGroupBy },
    availability: { findMany: availabilityFindMany },
    student: { findUnique: studentFindUnique },
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

type Fixture = { id: string; name: string; tutor: string; rate: string };
type Row = {
  subject_id: string;
  review_count: number;
  rating: number | null;
  classes_taught: number;
  next_available_at: Date | null;
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

// Postgres does the filtering, sorting and paging; here it answers with one page and a total.
function usePage(rows: Row[], total: number, details: Fixture[]) {
  queryRaw.mockImplementation(async (strings, ...values) => {
    const sql = Prisma.sql(strings, ...values).sql;
    if (sql.includes("AS total")) return [{ total }];
    if (sql.includes("AS min")) return [{ min: "75", max: "900.5" }];
    return rows;
  });
  // Prisma returns the page's details in any order.
  subjectFindMany.mockResolvedValue([...details].reverse().map(subjectRow));
}

// The SQL and parameters of the n-th raw query.
function rawQuery(n = 0) {
  const [strings, ...values] = queryRaw.mock.calls[n];
  return Prisma.sql(strings, ...values);
}

const calculus = { id: "calculus", name: "Calculus", tutor: "Anong", rate: "500.00" };
const physics = { id: "physics", name: "Physics", tutor: "Daniel", rate: "900.00" };

describe("DISC-1 tutor search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    studentFindUnique.mockResolvedValue(null);
    usePage(
      [
        {
          subject_id: "physics",
          review_count: 1,
          rating: 5,
          classes_taught: 0,
          next_available_at: null,
        },
        {
          subject_id: "calculus",
          review_count: 2,
          rating: 4.4999,
          classes_taught: 1,
          next_available_at: null,
        },
      ],
      7,
      [calculus, physics]
    );
  });

  it("is public: search, price range and learning areas need no login, the tutor page still does", async () => {
    learningAreaFindMany.mockResolvedValue([MATHEMATICS]);
    await request(app).get("/api/discovery/tutors").expect(200);
    await request(app).get("/api/discovery/price-range").expect(200);
    await request(app).get("/api/discovery/learning-areas").expect(200);
    await request(app).get(`/api/discovery/tutors/${TUTOR_ID}`).expect(401);
  });

  it("uses valid tokens for personalization and treats invalid tokens as guests", async () => {
    const anonymous = await request(app).get("/api/discovery/tutors").expect(200);
    expect(anonymous.body.recommendationMode).toBe("fallback");

    const invalid = await request(app)
      .get("/api/discovery/tutors")
      .set("Authorization", "Bearer invalid.token.value")
      .expect(200);
    expect(invalid.body.recommendationMode).toBe("fallback");
    expect(invalid.headers.vary).toContain("Authorization");
  });

  it("loads learning areas from the authenticated Student and disables shared caching", async () => {
    studentFindUnique.mockResolvedValue({ learningAreas: [{ learningAreaId: MATHEMATICS.id }] });
    const response = await request(app)
      .get("/api/discovery/tutors")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(200);

    expect(studentFindUnique).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      select: { learningAreas: { select: { learningAreaId: true } } },
    });
    expect(response.body.recommendationMode).toBe("personalized");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.vary).toContain("Authorization");
    expect(rawQuery(0).sql).toContain("recommendation_score DESC");
    expect(rawQuery(0).sql).toContain("0.5 *");
    expect(rawQuery(0).sql).toContain("0.3 *");
    expect(rawQuery(0).sql).toContain("0.2 *");
    expect(rawQuery(0).values).toContain(MATHEMATICS.id);
  });

  it("uses fallback ranking for an authenticated account without a Student profile", async () => {
    studentFindUnique.mockResolvedValue(null);
    const response = await request(app)
      .get("/api/discovery/tutors")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(200);

    expect(response.body.recommendationMode).toBe("fallback");
    expect(rawQuery(0).sql).toContain("0.6 *");
    expect(rawQuery(0).sql).toContain("0.4 *");
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
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a minimum price above the maximum", async () => {
    await request(app)
      .get("/api/discovery/tutors")
      .query({ minPrice: "700", maxPrice: "600" })
      .expect(400);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("sends every filter to the database as parameters, never as SQL text", async () => {
    await request(app)
      .get("/api/discovery/tutors")
      .query({
        q: "50% off_peak",
        tutorName: "anong",
        learningAreaId: MATHEMATICS.id,
        minPrice: "200",
        maxPrice: "600",
        minRating: "4.5",
        format: "ONLINE",
      })
      .expect(200);

    const page = rawQuery(0);
    expect(page.sql).toContain("t.status = 'PUBLISHED'");
    expect(page.sql).toContain("v.status = 'APPROVED'");
    expect(page.sql).toContain("x.learning_area_id");
    expect(page.sql).toContain("s.hourly_rate >=");
    expect(page.sql).toContain("s.hourly_rate <=");
    expect(page.sql).toContain("s.format = ?");
    expect(page.sql).toContain("r.rating >=");
    expect(page.sql).not.toContain("anong");
    expect(page.values).toEqual(
      expect.arrayContaining([MATHEMATICS.id, 200, 600, 4.5, "ONLINE", "%anong%"])
    );
    // Typed % and _ are matched literally, not as LIKE wildcards.
    expect(page.values).toEqual(expect.arrayContaining(["%50\\%%", "%off\\_peak%"]));
    // The keyword searches the subject; the name searches the tutor.
    expect(page.sql.match(/s\.name ILIKE/g)).toHaveLength(2);
    expect(page.sql.match(/u\.first_name ILIKE/g)).toHaveLength(1);
    // The total counts the same matches.
    expect(rawQuery(1).sql).toContain("COUNT(*)");
    expect(rawQuery(1).values).toEqual(
      expect.arrayContaining([MATHEMATICS.id, 200, 600, 4.5, "ONLINE", "%anong%"])
    );
    expect(rawQuery(1).sql).not.toContain("FROM availability_subjects");
    expect(rawQuery(1).sql).not.toContain("FROM bookings");
    expect(rawQuery(1).sql).not.toContain("0.2 *");
    expect(rawQuery(1).sql).not.toContain("relevance.match_count");
  });

  it.each([
    ["recommended", "recommendation_score DESC, review_count DESC"],
    ["rating", "rating DESC NULLS LAST, review_count DESC"],
    ["price_asc", "hourly_rate ASC"],
    ["price_desc", "hourly_rate DESC"],
  ])("sorts by %s in the database with stable tie-breakers", async (sort, order) => {
    const response = await request(app).get("/api/discovery/tutors").query({ sort }).expect(200);
    expect(response.body.recommendationMode).toBe(sort === "recommended" ? "fallback" : null);
    expect(rawQuery(0).sql).toContain(`ORDER BY ${order}, name, first_name, last_name, subject_id`);
  });

  it("asks the database for only the requested page", async () => {
    await request(app).get("/api/discovery/tutors").query({ page: "3", pageSize: "5" }).expect(200);
    const page = rawQuery(0);
    expect(page.sql).toMatch(/LIMIT \? OFFSET \?/);
    expect(page.values.slice(-2)).toEqual([5, 10]);
  });

  it.each(["price_asc", "price_desc", "rating"])(
    "loads availability only for the selected page when sorting by %s",
    async (sort) => {
      await request(app).get("/api/discovery/tutors").query({ sort }).expect(200);
      const sql = rawQuery(0).sql;
      const pageEnd = sql.indexOf("FROM page");
      expect(sql.slice(0, pageEnd)).not.toContain("FROM availability_subjects");
      expect(sql.slice(pageEnd)).toContain("LEFT JOIN LATERAL");
      expect(sql.slice(pageEnd)).toContain("avs.subject_id = page.subject_id");
      expect(rawQuery(1).sql).not.toContain("FROM availability_subjects");
      expect(rawQuery(1).sql).not.toContain("FROM reviews");
    }
  );

  it("reuses the first page's reference time for subsequent recommendation pages", async () => {
    const first = await request(app).get("/api/discovery/tutors").expect(200);
    const referenceTime = first.body.asOf;
    const firstValues = rawQuery(0).values.slice(0, -2);
    const second = await request(app)
      .get("/api/discovery/tutors")
      .query({ page: "2", asOf: referenceTime })
      .expect(200);
    expect(second.body.asOf).toBe(referenceTime);
    expect(rawQuery(2).values.slice(0, -2)).toEqual(firstValues);
    expect(rawQuery(2).values.slice(-2)).toEqual([12, 12]);
  });

  it("rejects an invalid reference timestamp", async () => {
    await request(app).get("/api/discovery/tutors").query({ asOf: "invalid" }).expect(400);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["recent", -30 * 60 * 1000, true],
    ["exactly one hour old", -60 * 60 * 1000, true],
    ["over one hour old", -60 * 60 * 1000 - 1, false],
    ["a week old", -7 * 24 * 60 * 60 * 1000, false],
    ["just in the future", 1, false],
    ["a week in the future", 7 * 24 * 60 * 60 * 1000, false],
  ])("bounds a %s pagination reference time", async (_label, offset, accepted) => {
    const currentTime = Date.parse("2026-10-18T12:00:00.000Z");
    const clock = jest.spyOn(Date, "now").mockReturnValue(currentTime);
    try {
      const asOf = new Date(currentTime + offset).toISOString();
      const expected = accepted ? asOf : new Date(currentTime).toISOString();
      const response = await request(app)
        .get("/api/discovery/tutors")
        .query({ page: "2", asOf })
        .expect(200);

      expect(response.body.asOf).toBe(expected);
      expect(rawQuery(0).values).toContain(expected);
    } finally {
      clock.mockRestore();
    }
  });

  it("returns the page in the database's order with each subject's own numbers", async () => {
    const response = await request(app).get("/api/discovery/tutors").expect(200);
    expect(subjectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["physics", "calculus"] } } })
    );
    expect(response.body.results.map(({ id }: { id: string }) => id)).toEqual([
      "physics",
      "calculus",
    ]);
    expect(response.body.results[0]).toEqual({
      id: "physics",
      name: "Physics",
      description: "Physics lessons",
      hourlyRate: "900.00",
      format: "ONLINE",
      learningAreas: [MATHEMATICS],
      rating: 5,
      reviewCount: 1,
      classesTaught: 0,
      nextAvailableAt: null,
      tutor: {
        id: "tutor-Daniel",
        firstName: "Daniel",
        lastName: "Tutor",
        bio: "Daniel teaches.",
        verified: true,
      },
    });
    expect(response.body.results[1]).toMatchObject({ rating: 4.5, classesTaught: 1 });
    expect(response.body).toMatchObject({ page: 1, pageSize: 12, total: 7, totalPages: 1 });
    expect(response.body).not.toHaveProperty("priceRange");
    expect(JSON.stringify(response.body)).not.toContain("identificationCard");
  });

  it("returns an empty page with the real total when the page is past the end", async () => {
    usePage([], 7, []);
    const response = await request(app)
      .get("/api/discovery/tutors")
      .query({ page: "9", pageSize: "5" })
      .expect(200);
    expect(response.body).toEqual({
      results: [],
      page: 9,
      pageSize: 5,
      total: 7,
      totalPages: 2,
      recommendationMode: "fallback",
      asOf: expect.any(String),
    });
  });

  it("counts a class as taught when completed, or confirmed and already over", async () => {
    await request(app).get("/api/discovery/tutors").expect(200);
    const page = rawQuery(0);
    expect(page.sql).toContain("status = 'COMPLETED' OR (status = 'CONFIRMED' AND ended_at <=");
    const now = page.values.find((value) => typeof value === "string" && value.endsWith("Z"));
    expect(Date.now() - Date.parse(now as string)).toBeLessThan(10_000);
  });

  it("gives the price slider the range of every listed subject", async () => {
    const response = await request(app).get("/api/discovery/price-range").expect(200);
    expect(response.body).toEqual({ priceRange: { min: "75.00", max: "900.50" } });
    expect(rawQuery(0).sql).toContain("t.status = 'PUBLISHED'");
    queryRaw.mockResolvedValueOnce([{ min: null, max: null }]);
    const empty = await request(app).get("/api/discovery/price-range").expect(200);
    expect(empty.body).toEqual({ priceRange: null });
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

describe("DISC-3 tutor profile", () => {
  const url = `/api/discovery/tutors/${TUTOR_ID}/profile`;
  const soon = new Date(Date.now() + 2 * 86_400_000);
  const later = new Date(Date.now() + 40 * 86_400_000);

  function publishedTutor(overrides: Record<string, unknown> = {}) {
    return {
      id: TUTOR_ID,
      status: "PUBLISHED",
      user: { id: USER_ID, firstName: "Anong", lastName: "Pattanakul" },
      currentProfileVersion: {
        status: "APPROVED",
        bio: "Approved bio",
        avatarUrl: null,
        introVideoUrl: "https://www.youtube.com/watch?v=abc",
      },
      subjects: [
        {
          id: "calculus",
          name: "Calculus",
          description: "Limits and derivatives",
          hourlyRate: new Prisma.Decimal("500"),
          format: "ONLINE",
          learningAreas: [{ learningArea: MATHEMATICS }],
        },
        {
          id: "physics",
          name: "Physics",
          description: null,
          hourlyRate: new Prisma.Decimal("650.5"),
          format: "ONLINE",
          learningAreas: [],
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    bookingFindMany.mockResolvedValue([]);
    queryRaw.mockReset().mockResolvedValue([
      { subjectId: "calculus", startedAt: soon },
      { subjectId: "physics", startedAt: soon },
    ]);
    profileTutorFindUnique.mockResolvedValue(publishedTutor());
    reviewAggregate.mockResolvedValue({ _avg: { ratingStars: 4.25 }, _count: 4 });
    reviewGroupBy.mockResolvedValue([
      { subjectId: "calculus", _avg: { ratingStars: 4.5 }, _count: 2 },
    ]);
    reviewFindMany.mockResolvedValue([
      {
        id: "review-1",
        ratingStars: 5,
        text: "Clear explanations.",
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
        subject: { name: "Calculus" },
        user: { firstName: "Bob", lastName: "Student" },
      },
    ]);
    availabilityFindMany.mockResolvedValue([
      {
        startedAt: soon,
        availabilitySubjects: [{ subjectId: "physics" }, { subjectId: "calculus" }],
      },
    ]);
  });

  it("is public and shows bio, rating, rates, availability, video and reviews", async () => {
    const response = await request(app).get(url).expect(200);

    expect(response.body).toMatchObject({
      id: TUTOR_ID,
      userId: USER_ID,
      firstName: "Anong",
      lastName: "Pattanakul",
      verified: true,
      bio: "Approved bio",
      introVideoUrl: "https://www.youtube.com/watch?v=abc",
      rating: 4.3,
      reviewCount: 4,
    });
    expect(response.body.subjects).toEqual([
      expect.objectContaining({
        id: "calculus",
        hourlyRate: "500.00",
        rating: 4.5,
        reviewCount: 2,
        nextOpening: soon.toISOString(),
      }),
      expect.objectContaining({
        id: "physics",
        hourlyRate: "650.50",
        rating: null,
        reviewCount: 0,
        nextOpening: soon.toISOString(),
      }),
    ]);
    expect(response.body.reviews).toEqual([
      {
        id: "review-1",
        rating: 5,
        text: "Clear explanations.",
        createdAt: "2026-09-01T10:00:00.000Z",
        subjectName: "Calculus",
        reviewer: "Bob S.",
      },
    ]);
  });

  it("lists only the next two weeks of openings, each with its subjects", async () => {
    const response = await request(app).get(url).expect(200);

    expect(response.body.availability).toEqual([
      { startedAt: soon.toISOString(), subjectIds: ["calculus", "physics"] },
    ]);
  });

  it("asks only for future open slots that are not held or booked", async () => {
    await request(app).get(url).expect(200);

    expect(bookingFindMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(availabilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tutorId: TUTOR_ID,
          isOpen: true,
          bookingId: null,
          availabilitySubjects: { some: {} },
        }),
      })
    );
  });

  it("bounds detailed slots to 14 days and groups the 92-day next openings in SQL", async () => {
    queryRaw.mockResolvedValue([
      { subjectId: "calculus", startedAt: soon },
      { subjectId: "physics", startedAt: later },
    ]);
    const response = await request(app).get(url).expect(200);
    const details = availabilityFindMany.mock.calls[0][0] as {
      where: { startedAt: { gt: Date; lt: Date } };
    };
    expect(details.where.startedAt.lt.getTime() - details.where.startedAt.gt.getTime()).toBe(
      14 * 86_400_000
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const grouped = rawQuery();
    expect(grouped.sql).toContain("MIN(slots.started_at)");
    expect(grouped.sql).toContain("GROUP BY links.subject_id");
    expect(grouped.sql).toContain("slots.is_open = TRUE AND slots.booking_id IS NULL");
    expect(grouped.sql).not.toContain(TUTOR_ID);
    const [tutorId, from, until] = grouped.values as [string, Date, Date];
    expect(tutorId).toBe(TUTOR_ID);
    expect(until.getTime() - from.getTime()).toBe(92 * 86_400_000);
    expect(response.body.subjects[1].nextOpening).toBe(later.toISOString());
    expect(response.body.availability).toHaveLength(1);
  });

  it.each([
    ["😀Name", "Anna 😀."],
    ["\u{10400}Name", "Anna \u{10400}."],
    ["", "Anna"],
    ["   ", "Anna"],
  ])(
    "formats reviewer surname %s without splitting code points or adding empty punctuation",
    async (lastName, expected) => {
      reviewFindMany.mockResolvedValue([
        {
          id: "unicode",
          ratingStars: 5,
          text: null,
          createdAt: soon,
          subject: { name: "Calculus" },
          user: { firstName: "Anna", lastName },
        },
      ]);
      const response = await request(app).get(url).expect(200);
      expect(response.body.reviews[0].reviewer).toBe(expected);
    }
  );

  it("shows no rating for a tutor without reviews", async () => {
    reviewAggregate.mockResolvedValue({ _avg: { ratingStars: null }, _count: 0 });
    reviewGroupBy.mockResolvedValue([]);
    reviewFindMany.mockResolvedValue([]);

    const response = await request(app).get(url).expect(200);

    expect(response.body).toMatchObject({ rating: null, reviewCount: 0, reviews: [] });
  });

  it("never exposes private verification details", async () => {
    profileTutorFindUnique.mockResolvedValue(
      publishedTutor({
        currentProfileVersion: {
          status: "APPROVED",
          bio: "Bio",
          avatarUrl: null,
          introVideoUrl: null,
          identificationCardUrl: "https://example.com/private-id.pdf",
        },
      })
    );

    const response = await request(app).get(url).expect(200);

    expect(JSON.stringify(response.body)).not.toContain("private-id");
    expect(response.body).not.toHaveProperty("identificationCardUrl");
  });

  it.each([
    ["unpublished", { status: "UNPUBLISHED" }],
    [
      "without an approved current profile",
      {
        currentProfileVersion: {
          status: "PENDING",
          bio: "Draft bio",
          avatarUrl: null,
          introVideoUrl: null,
        },
      },
    ],
    ["without an account", { user: null }],
  ])("is unavailable and shows no details when the tutor is %s", async (_label, overrides) => {
    profileTutorFindUnique.mockResolvedValue(publishedTutor(overrides));

    const response = await request(app).get(url).expect(404);

    expect(response.body).toEqual({ message: "This tutor profile is unavailable" });
    expect(reviewFindMany).not.toHaveBeenCalled();
    expect(availabilityFindMany).not.toHaveBeenCalled();
  });

  it("is unavailable when the tutor does not exist or the id is not a UUID", async () => {
    profileTutorFindUnique.mockResolvedValue(null);
    await request(app).get(url).expect(404);

    profileTutorFindUnique.mockClear();
    const response = await request(app).get("/api/discovery/tutors/not-a-uuid/profile").expect(404);
    expect(response.body).toEqual({ message: "This tutor profile is unavailable" });
    expect(profileTutorFindUnique).not.toHaveBeenCalled();
  });
});
