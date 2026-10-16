import type { Prisma } from "../../generated/prisma/client.ts";
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

function keywordFilter(term: string): Prisma.TutorWhereInput {
  const contains = { contains: term, mode: "insensitive" as const };
  return {
    OR: [
      { user: { is: { firstName: contains } } },
      { user: { is: { lastName: contains } } },
      { currentProfileVersion: { bio: contains } },
      { subjects: { some: { OR: [{ name: contains }, { description: contains }] } } },
    ],
  };
}

type TutorStats = { reviewCount: number; ratingSum: number; classesTaught: number };

// Ratings and taught classes are counted per subject, then added up per tutor.
async function statsByTutor(tutorIds: string[], now: Date) {
  const stats = new Map<string, TutorStats>(
    tutorIds.map((id) => [id, { reviewCount: 0, ratingSum: 0, classesTaught: 0 }])
  );
  if (tutorIds.length === 0) return stats;

  const ofTheseTutors = { subject: { tutorId: { in: tutorIds } } };
  const [subjects, reviews, taught] = await Promise.all([
    prisma.subject.findMany({
      where: { tutorId: { in: tutorIds } },
      select: { id: true, tutorId: true },
    }),
    prisma.review.groupBy({
      by: ["subjectId"],
      where: ofTheseTutors,
      _sum: { ratingStars: true },
      _count: { _all: true },
    }),
    // Nothing marks bookings COMPLETED yet, so a confirmed lesson that has ended counts too.
    prisma.booking.groupBy({
      by: ["subjectId"],
      where: {
        ...ofTheseTutors,
        OR: [{ status: "COMPLETED" }, { status: "CONFIRMED", endedAt: { lte: now } }],
      },
      _count: { _all: true },
    }),
  ]);

  const tutorOf = new Map(subjects.map(({ id, tutorId }) => [id, tutorId]));
  for (const row of reviews) {
    const tutor = stats.get(tutorOf.get(row.subjectId) ?? "");
    if (!tutor) continue;
    tutor.reviewCount += row._count._all;
    tutor.ratingSum += row._sum.ratingStars ?? 0;
  }
  for (const row of taught) {
    const tutor = stats.get(tutorOf.get(row.subjectId) ?? "");
    if (tutor) tutor.classesTaught += row._count._all;
  }
  return stats;
}

export async function searchTutors(query: TutorSearchQuery, now = new Date()) {
  // Area, price and format must all hold for the same subject.
  const subjectWhere: Prisma.SubjectWhereInput = {
    ...(query.learningAreaId && {
      learningAreas: { some: { learningAreaId: query.learningAreaId } },
    }),
    ...(query.maxPrice !== undefined && { hourlyRate: { lte: query.maxPrice } }),
    ...(query.format && { format: query.format }),
  };
  const terms = query.q?.split(/\s+/).filter(Boolean).slice(0, 5) ?? [];

  const tutors = await prisma.tutor.findMany({
    where: {
      status: "PUBLISHED",
      user: { isNot: null },
      currentProfileVersion: { status: "APPROVED" },
      subjects: { some: subjectWhere },
      AND: terms.map(keywordFilter),
    },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
      currentProfileVersion: { select: { bio: true } },
      subjects: {
        where: subjectWhere,
        select: subjectSelect,
        orderBy: [{ hourlyRate: "asc" }, { name: "asc" }, { id: "asc" }],
      },
    },
  });

  const stats = await statsByTutor(
    tutors.map(({ id }) => id),
    now
  );
  const results = tutors.flatMap((tutor) => {
    const { reviewCount, ratingSum, classesTaught } = stats.get(tutor.id)!;
    const cheapest = tutor.subjects[0];
    if (!tutor.user || !cheapest) return [];
    return [
      {
        tutor,
        name: `${tutor.user.firstName} ${tutor.user.lastName}`,
        rating: reviewCount ? ratingSum / reviewCount : null,
        reviewCount,
        classesTaught,
        fromHourlyRate: cheapest.hourlyRate,
      },
    ];
  });

  type Result = (typeof results)[number];
  const minRating = query.minRating ?? 0;
  const matching = results.filter(({ rating }) => minRating === 0 || (rating ?? 0) >= minRating);
  const byRating = (a: Result, b: Result) => (b.rating ?? -1) - (a.rating ?? -1);
  const compare = {
    recommended: (a: Result, b: Result) =>
      b.classesTaught - a.classesTaught || b.reviewCount - a.reviewCount || byRating(a, b),
    rating: (a: Result, b: Result) => byRating(a, b) || b.reviewCount - a.reviewCount,
    price_asc: (a: Result, b: Result) => a.fromHourlyRate.cmp(b.fromHourlyRate),
    price_desc: (a: Result, b: Result) => b.fromHourlyRate.cmp(a.fromHourlyRate),
  }[query.sort];
  // Name and id break ties so the same search always pages the same way.
  matching.sort(
    (a, b) => compare(a, b) || a.name.localeCompare(b.name) || a.tutor.id.localeCompare(b.tutor.id)
  );

  const start = (query.page - 1) * query.pageSize;
  return {
    tutors: matching.slice(start, start + query.pageSize).map((result) => ({
      id: result.tutor.id,
      firstName: result.tutor.user!.firstName,
      lastName: result.tutor.user!.lastName,
      bio: result.tutor.currentProfileVersion.bio,
      verified: true,
      rating: result.rating === null ? null : Math.round(result.rating * 10) / 10,
      reviewCount: result.reviewCount,
      classesTaught: result.classesTaught,
      fromHourlyRate: result.fromHourlyRate.toFixed(2),
      subjects: result.tutor.subjects.map(mapSubject),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: matching.length,
    totalPages: Math.max(1, Math.ceil(matching.length / query.pageSize)),
  };
}
