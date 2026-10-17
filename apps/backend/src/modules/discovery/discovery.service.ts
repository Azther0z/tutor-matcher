import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { publicPortfolioSelect, publicCertificationUrls } from "../profile/profile.public.ts";
import { mapSubject, subjectSelect } from "../subject/subject.public.ts";
import type { TutorSearchQuery } from "./discovery.schema.ts";

export class TutorNotFoundError extends Error {
  constructor() {
    super("Tutor not found");
    this.name = "TutorNotFoundError";
  }
}

export async function getTutorSummary(tutorId: string) {
  const tutor = await prisma.user.findUnique({
    where: { tutorId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      tutor: {
        select: {
          id: true,
          status: true,
          currentProfileVersion: {
            select: { bio: true, avatarUrl: true, introVideoUrl: true, ...publicPortfolioSelect },
          },
        },
      },
    },
  });

  if (!tutor?.tutor) {
    throw new TutorNotFoundError();
  }

  return {
    id: tutor.tutor.id,
    userId: tutor.id,
    firstName: tutor.firstName,
    lastName: tutor.lastName,
    status: tutor.tutor.status,
    verified: true,
    bio: tutor.tutor.currentProfileVersion.bio,
    avatarUrl: tutor.tutor.currentProfileVersion.avatarUrl,
    introVideoUrl: tutor.tutor.currentProfileVersion.introVideoUrl,
    certificationUrls: publicCertificationUrls(tutor.tutor.currentProfileVersion),
  };
}

// Keep "Other" at the end so the real areas read alphabetically first.
export async function listLearningAreas() {
  const areas = await prisma.learningArea.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return [
    ...areas.filter(({ name }) => name !== "Other"),
    ...areas.filter(({ name }) => name === "Other"),
  ];
}

const words = (text?: string) => text?.split(/\s+/).filter(Boolean).slice(0, 5) ?? [];
// Typed words are matched literally, so % and _ don't act as LIKE wildcards.
const likePattern = (word: string) => `%${word.replace(/[\\%_]/g, "\\$&")}%`;
const ilike = (column: Prisma.Sql, word: string) =>
  Prisma.sql`${column} ILIKE ${likePattern(word)} ESCAPE '\\'`;

// Only subjects of published tutors with an approved current profile are listed.
const listedSubjects = Prisma.sql`
  subjects s
  JOIN tutors t ON t.tutor_id = s.tutor_id AND t.status = 'PUBLISHED'
  JOIN users u ON u.tutor_id = t.tutor_id
  JOIN tutor_profile_versions v
    ON v.profile_version_id = t.current_profile_version_id AND v.status = 'APPROVED'`;

// Filters, per-subject stats, sorting and paging all run in Postgres, so a page costs one page.
function matchingSubjects(
  query: TutorSearchQuery,
  now: Date,
  studentAreaIds: string[],
  options: { includeAvailability: boolean; includeRecommendation: boolean; includeStats: boolean }
) {
  const conditions: Prisma.Sql[] = [];
  if (query.learningAreaId)
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM subject_learning_areas x
      WHERE x.subject_id = s.subject_id AND x.learning_area_id = ${query.learningAreaId}::uuid)`);
  if (query.minPrice !== undefined) conditions.push(Prisma.sql`s.hourly_rate >= ${query.minPrice}`);
  if (query.maxPrice !== undefined) conditions.push(Prisma.sql`s.hourly_rate <= ${query.maxPrice}`);
  if (query.format) conditions.push(Prisma.sql`s.format = ${query.format}::"SubjectFormat"`);
  // The keyword searches the subject itself; the tutor's name has its own filter.
  for (const word of words(query.q))
    conditions.push(
      Prisma.sql`(${ilike(Prisma.sql`s.name`, word)} OR ${ilike(Prisma.sql`s.description`, word)})`
    );
  for (const word of words(query.tutorName))
    conditions.push(
      Prisma.sql`(${ilike(Prisma.sql`u.first_name`, word)} OR ${ilike(Prisma.sql`u.last_name`, word)})`
    );
  if (query.minRating) conditions.push(Prisma.sql`r.rating >= ${query.minRating}`);

  const needsRating =
    options.includeStats ||
    options.includeRecommendation ||
    query.sort === "rating" ||
    !!query.minRating;
  const reviewsJoin = needsRating
    ? Prisma.sql`LEFT JOIN (
        SELECT subject_id, COUNT(*) AS review_count, AVG(rating_stars)::float8 AS rating
        FROM reviews GROUP BY subject_id
      ) r ON r.subject_id = s.subject_id`
    : Prisma.empty;
  const statsJoin = options.includeStats
    ? Prisma.sql`LEFT JOIN (
        SELECT subject_id, COUNT(*) AS classes_taught FROM bookings
        WHERE status = 'COMPLETED' OR (status = 'CONFIRMED' AND ended_at <= ${now.toISOString()}::timestamp)
        GROUP BY subject_id
      ) b ON b.subject_id = s.subject_id`
    : Prisma.empty;
  const relevanceJoin = options.includeRecommendation
    ? Prisma.sql`LEFT JOIN (
        SELECT x.subject_id, COUNT(*)::int AS match_count
        FROM subject_learning_areas x
        WHERE x.learning_area_id IN (${studentAreaIds.length ? Prisma.join(studentAreaIds.map((id) => Prisma.sql`${id}::uuid`)) : Prisma.sql`NULL::uuid`})
        GROUP BY x.subject_id
      ) relevance ON relevance.subject_id = s.subject_id`
    : Prisma.empty;
  const availabilityJoin = options.includeAvailability
    ? Prisma.sql`LEFT JOIN (
        SELECT avs.subject_id, MIN(av.started_at) AS next_available_at
        FROM availability_subjects avs
        JOIN availabilities av ON av.availability_id = avs.availability_id
        WHERE av.is_open = TRUE AND av.booking_id IS NULL
          AND av.started_at > ${now.toISOString()}::timestamp
          AND av.started_at <= ${new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()}::timestamp
        GROUP BY avs.subject_id
      ) a ON a.subject_id = s.subject_id`
    : Prisma.empty;
  const recommendationColumns = options.includeRecommendation
    ? Prisma.sql`a.next_available_at,
        CASE WHEN ${studentAreaIds.length > 0}
          THEN COALESCE(relevance.match_count, 0)::float8 / ${Math.max(studentAreaIds.length, 1)}
          ELSE 0::float8 END AS relevance,
        CASE WHEN ${studentAreaIds.length > 0}
          THEN (0.5 * (COALESCE(relevance.match_count, 0)::float8 / ${Math.max(studentAreaIds.length, 1)}))
            + (0.3 * (COALESCE(r.rating, 0)::float8 / 5.0))
            + (0.2 * CASE WHEN a.next_available_at IS NULL THEN 0 ELSE
                GREATEST(0, 1 - EXTRACT(EPOCH FROM (a.next_available_at - ${now.toISOString()}::timestamp)) / (30 * 24 * 60 * 60)) END)
          ELSE (0.6 * (COALESCE(r.rating, 0)::float8 / 5.0))
            + (0.4 * CASE WHEN a.next_available_at IS NULL THEN 0 ELSE
                GREATEST(0, 1 - EXTRACT(EPOCH FROM (a.next_available_at - ${now.toISOString()}::timestamp)) / (30 * 24 * 60 * 60)) END)
          END AS recommendation_score`
    : Prisma.sql`${options.includeAvailability ? Prisma.sql`a.next_available_at` : Prisma.sql`NULL::timestamp`} AS next_available_at,
        0::float8 AS relevance, 0::float8 AS recommendation_score`;
  const ratingColumns = needsRating
    ? Prisma.sql`COALESCE(r.review_count, 0)::int AS review_count, r.rating`
    : Prisma.sql`0::int AS review_count, NULL::float8 AS rating`;
  const classesTaughtColumn = options.includeStats
    ? Prisma.sql`COALESCE(b.classes_taught, 0)::int AS classes_taught`
    : Prisma.sql`0::int AS classes_taught`;

  // Nothing marks bookings COMPLETED yet, so a confirmed lesson that has ended counts too.
  return Prisma.sql`
    SELECT s.subject_id, s.name, s.hourly_rate, u.first_name, u.last_name,
      ${ratingColumns},
      ${classesTaughtColumn},
      ${recommendationColumns}
    FROM ${listedSubjects}
    ${reviewsJoin}
    ${statsJoin}
    ${relevanceJoin}
    ${availabilityJoin}
    ${conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty}`;
}

// Subject, tutor and id break ties so the same search always pages the same way.
const sortOrder = {
  recommended: Prisma.sql`recommendation_score DESC, review_count DESC`,
  rating: Prisma.sql`rating DESC NULLS LAST, review_count DESC`,
  price_asc: Prisma.sql`hourly_rate ASC`,
  price_desc: Prisma.sql`hourly_rate DESC`,
} satisfies Record<TutorSearchQuery["sort"], Prisma.Sql>;

type SearchRow = {
  subject_id: string;
  review_count: number;
  rating: number | null;
  classes_taught: number;
  next_available_at: Date | string | null;
};

const resultSelect = {
  ...subjectSelect,
  tutor: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
      currentProfileVersion: { select: { bio: true } },
    },
  },
} satisfies Prisma.SubjectSelect;

// DISC-1: one result per tutor + subject, so every card shows one subject's own price.
export async function searchTutorSubjects(
  query: TutorSearchQuery,
  now = new Date(),
  userId?: string
) {
  const student =
    query.sort === "recommended" && userId
      ? await prisma.student.findUnique({
          where: { userId },
          select: { learningAreas: { select: { learningAreaId: true } } },
        })
      : null;
  const studentAreaIds = student?.learningAreas.map(({ learningAreaId }) => learningAreaId) ?? [];
  const recommendationMode =
    query.sort !== "recommended" ? null : studentAreaIds.length > 0 ? "personalized" : "fallback";
  const matching = matchingSubjects(query, now, studentAreaIds, {
    includeAvailability: true,
    includeRecommendation: query.sort === "recommended",
    includeStats: true,
  });
  const countMatching = matchingSubjects(query, now, studentAreaIds, {
    includeAvailability: false,
    includeRecommendation: false,
    includeStats: false,
  });
  const [rows, [{ total }]] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>`
      SELECT subject_id, review_count, rating, classes_taught, next_available_at FROM (${matching}) m
      ORDER BY ${sortOrder[query.sort]}, name, first_name, last_name, subject_id
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    prisma.$queryRaw<[{ total: number }]>`SELECT COUNT(*)::int AS total FROM (${countMatching}) m`,
  ]);

  const details = await prisma.subject.findMany({
    where: { id: { in: rows.map((row) => row.subject_id) } },
    select: resultSelect,
  });
  const byId = new Map(details.map((subject) => [subject.id, subject]));

  return {
    results: rows.flatMap((row) => {
      const subject = byId.get(row.subject_id);
      if (!subject?.tutor.user) return [];
      return [
        {
          ...mapSubject(subject),
          rating: row.rating === null ? null : Math.round(row.rating * 10) / 10,
          reviewCount: row.review_count,
          classesTaught: row.classes_taught,
          nextAvailableAt:
            row.next_available_at === null ? null : new Date(row.next_available_at).toISOString(),
          tutor: {
            id: subject.tutor.id,
            firstName: subject.tutor.user.firstName,
            lastName: subject.tutor.user.lastName,
            bio: subject.tutor.currentProfileVersion.bio,
            verified: true,
          },
        },
      ];
    }),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    recommendationMode,
  };
}

// The price slider covers every listed subject, so the page asks for it once, not per search.
export async function getPriceRange() {
  const [range] = await prisma.$queryRaw<[{ min: string | null; max: string | null }]>`
    SELECT MIN(s.hourly_rate)::text AS min, MAX(s.hourly_rate)::text AS max FROM ${listedSubjects}`;
  return range.min && range.max
    ? { min: Number(range.min).toFixed(2), max: Number(range.max).toFixed(2) }
    : null;
}
