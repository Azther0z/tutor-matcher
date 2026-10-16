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

const words = (text?: string) => text?.split(/\s+/).filter(Boolean).slice(0, 5) ?? [];
const containing = (word: string) => ({ contains: word, mode: "insensitive" as const });

// The keyword searches the subject itself; the tutor's name has its own filter.
function keywordFilter(word: string): Prisma.SubjectWhereInput {
  return { OR: [{ name: containing(word) }, { description: containing(word) }] };
}

function tutorNameFilter(word: string): Prisma.SubjectWhereInput {
  return {
    tutor: {
      user: {
        is: { OR: [{ firstName: containing(word) }, { lastName: containing(word) }] },
      },
    },
  };
}

const listedSubject = {
  tutor: {
    status: "PUBLISHED",
    user: { isNot: null },
    currentProfileVersion: { status: "APPROVED" },
  },
} satisfies Prisma.SubjectWhereInput;

type SubjectStats = { reviewCount: number; ratingSum: number; classesTaught: number };

// Each card is one subject, so its rating and classes taught are that subject's own.
async function statsBySubject(subjectIds: string[], now: Date) {
  const stats = new Map<string, SubjectStats>(
    subjectIds.map((id) => [id, { reviewCount: 0, ratingSum: 0, classesTaught: 0 }])
  );
  if (subjectIds.length === 0) return stats;

  const [reviews, taught] = await Promise.all([
    prisma.review.groupBy({
      by: ["subjectId"],
      where: { subjectId: { in: subjectIds } },
      _sum: { ratingStars: true },
      _count: { _all: true },
    }),
    // Nothing marks bookings COMPLETED yet, so a confirmed lesson that has ended counts too.
    prisma.booking.groupBy({
      by: ["subjectId"],
      where: {
        subjectId: { in: subjectIds },
        OR: [{ status: "COMPLETED" }, { status: "CONFIRMED", endedAt: { lte: now } }],
      },
      _count: { _all: true },
    }),
  ]);

  for (const row of reviews) {
    const subject = stats.get(row.subjectId);
    if (!subject) continue;
    subject.reviewCount = row._count._all;
    subject.ratingSum = row._sum.ratingStars ?? 0;
  }
  for (const row of taught) {
    const subject = stats.get(row.subjectId);
    if (subject) subject.classesTaught = row._count._all;
  }
  return stats;
}

// DISC-1: one result per tutor + subject, so every card shows one subject's own price.
export async function searchTutorSubjects(query: TutorSearchQuery, now = new Date()) {
  const subjects = await prisma.subject.findMany({
    where: {
      ...listedSubject,
      ...(query.learningAreaId && {
        learningAreas: { some: { learningAreaId: query.learningAreaId } },
      }),
      hourlyRate: {
        ...(query.minPrice !== undefined && { gte: query.minPrice }),
        ...(query.maxPrice !== undefined && { lte: query.maxPrice }),
      },
      ...(query.format && { format: query.format }),
      AND: [...words(query.q).map(keywordFilter), ...words(query.tutorName).map(tutorNameFilter)],
    },
    select: {
      ...subjectSelect,
      tutor: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
          currentProfileVersion: { select: { bio: true } },
        },
      },
    },
  });

  // The slider covers every listed subject, so it doesn't shrink as filters change.
  const [stats, prices] = await Promise.all([
    statsBySubject(
      subjects.map(({ id }) => id),
      now
    ),
    prisma.subject.aggregate({
      where: listedSubject,
      _min: { hourlyRate: true },
      _max: { hourlyRate: true },
    }),
  ]);
  const results = subjects.flatMap((subject) => {
    const { reviewCount, ratingSum, classesTaught } = stats.get(subject.id)!;
    const user = subject.tutor.user;
    if (!user) return [];
    return [
      {
        subject,
        user,
        tutorName: `${user.firstName} ${user.lastName}`,
        rating: reviewCount ? ratingSum / reviewCount : null,
        reviewCount,
        classesTaught,
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
    price_asc: (a: Result, b: Result) => a.subject.hourlyRate.cmp(b.subject.hourlyRate),
    price_desc: (a: Result, b: Result) => b.subject.hourlyRate.cmp(a.subject.hourlyRate),
  }[query.sort];
  // Subject, tutor and id break ties so the same search always pages the same way.
  matching.sort(
    (a, b) =>
      compare(a, b) ||
      a.subject.name.localeCompare(b.subject.name) ||
      a.tutorName.localeCompare(b.tutorName) ||
      a.subject.id.localeCompare(b.subject.id)
  );

  const start = (query.page - 1) * query.pageSize;
  return {
    results: matching.slice(start, start + query.pageSize).map((result) => ({
      ...mapSubject(result.subject),
      rating: result.rating === null ? null : Math.round(result.rating * 10) / 10,
      reviewCount: result.reviewCount,
      classesTaught: result.classesTaught,
      tutor: {
        id: result.subject.tutor.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        bio: result.subject.tutor.currentProfileVersion.bio,
        verified: true,
      },
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: matching.length,
    totalPages: Math.max(1, Math.ceil(matching.length / query.pageSize)),
    priceRange:
      prices._min.hourlyRate && prices._max.hourlyRate
        ? { min: prices._min.hourlyRate.toFixed(2), max: prices._max.hourlyRate.toFixed(2) }
        : null,
  };
}
