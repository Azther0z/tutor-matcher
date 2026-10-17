import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const tutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const subjectFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const queryRaw =
  jest.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>>();
const learningAreaFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const studentFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: tutorFindUnique },
    subject: { findMany: subjectFindMany },
    $queryRaw: queryRaw,
    learningArea: { findMany: learningAreaFindMany },
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

  it("uses optional authentication only for valid recommendation tokens", async () => {
    const anonymous = await request(app).get("/api/discovery/tutors").expect(200);
    expect(anonymous.body.recommendationMode).toBe("fallback");

    await request(app)
      .get("/api/discovery/tutors")
      .set("Authorization", "Bearer invalid.token.value")
      .expect(401);
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
    expect(rawQuery(1).values).toEqual(page.values.slice(0, rawQuery(1).values.length));
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
    expect(page.sql).toMatch(/LIMIT \? OFFSET \?\s*$/);
    expect(page.values.slice(-2)).toEqual([5, 10]);
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
