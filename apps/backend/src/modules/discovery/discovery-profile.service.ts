import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { publicPortfolioSelect, publicCertificationUrls } from "../profile/profile.public.ts";
import { mapSubject, subjectSelect } from "../subject/subject.public.ts";

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

export class TutorUnavailableError extends Error {
  constructor() {
    super("This tutor profile is unavailable");
    this.name = "TutorUnavailableError";
  }
}

export class SubjectUnavailableError extends Error {
  constructor() {
    super("This subject is unavailable");
    this.name = "SubjectUnavailableError";
  }
}

const RECENT_REVIEW_LIMIT = 10;
// Students browse up to three months ahead; the profile lists the next two weeks in detail.
const OPENINGS_WINDOW_DAYS = 92;
const OPENINGS_LISTED_DAYS = 14;
const DAY_MS = 86_400_000;
// Bangkok has no daylight saving, so each Bangkok day starts at 17:00 UTC the day before.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const bangkokDate = (instant: Date) =>
  new Date(instant.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
const bangkokDayStart = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) - BANGKOK_OFFSET_MS);

const publicReviewSelect = {
  id: true,
  ratingStars: true,
  text: true,
  createdAt: true,
  subject: { select: { name: true } },
  user: { select: { firstName: true, lastName: true } },
} as const satisfies Prisma.ReviewSelect;

function publicReview(review: Prisma.ReviewGetPayload<{ select: typeof publicReviewSelect }>) {
  const lastInitial = Array.from(review.user.lastName.trim())[0];
  return {
    id: review.id,
    rating: review.ratingStars,
    text: review.text,
    createdAt: review.createdAt.toISOString(),
    subjectName: review.subject.name,
    // Reviewers appear as first name and last initial only.
    reviewer: `${review.user.firstName}${lastInitial ? ` ${lastInitial}.` : ""}`.trim(),
  };
}

const roundedRating = (average: number | null) =>
  average === null ? null : Math.round(average * 10) / 10;

// DISC-3: the public profile page. Only a published tutor with an approved current profile
// is shown; anything else is "unavailable" and leaks none of its details.
export async function getTutorProfile(tutorId: string, now = new Date()) {
  const tutor = await prisma.tutor.findUnique({
    where: { id: tutorId },
    select: {
      id: true,
      status: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      currentProfileVersion: {
        select: { status: true, bio: true, avatarUrl: true, introVideoUrl: true },
      },
      subjects: { select: subjectSelect, orderBy: [{ name: "asc" }, { id: "asc" }] },
    },
  });

  if (
    !tutor?.user ||
    tutor.status !== "PUBLISHED" ||
    tutor.currentProfileVersion.status !== "APPROVED"
  ) {
    throw new TutorUnavailableError();
  }

  // This public read does not mutate bookings. Existing booking flows release expired holds.
  const listedUntil = new Date(now.getTime() + OPENINGS_LISTED_DAYS * DAY_MS);
  const openingsUntil = new Date(now.getTime() + OPENINGS_WINDOW_DAYS * DAY_MS);
  const reviewWhere = { subject: { tutorId } };
  const [aggregate, reviews, slots, subjectRatings, nextOpenings] = await Promise.all([
    prisma.review.aggregate({ where: reviewWhere, _avg: { ratingStars: true }, _count: true }),
    prisma.review.findMany({
      where: reviewWhere,
      select: publicReviewSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: RECENT_REVIEW_LIMIT,
    }),
    prisma.availability.findMany({
      where: {
        tutorId,
        isOpen: true,
        bookingId: null,
        startedAt: { gt: now, lt: listedUntil },
        availabilitySubjects: { some: {} },
      },
      select: { startedAt: true, availabilitySubjects: { select: { subjectId: true } } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.review.groupBy({
      by: ["subjectId"],
      where: reviewWhere,
      _avg: { ratingStars: true },
      _count: true,
    }),
    // Return one timestamp per subject, not every slot/link across the 92-day horizon.
    prisma.$queryRaw<Array<{ subjectId: string; startedAt: Date }>>`
      SELECT links.subject_id AS "subjectId", MIN(slots.started_at) AS "startedAt"
      FROM availabilities slots
      JOIN availability_subjects links ON links.availability_id = slots.availability_id
      WHERE slots.tutor_id = ${tutorId}::uuid
        AND slots.is_open = TRUE AND slots.booking_id IS NULL
        AND slots.started_at > ${now} AND slots.started_at < ${openingsUntil}
      GROUP BY links.subject_id
    `,
  ]);

  const ratingBySubject = new Map(subjectRatings.map((row) => [row.subjectId, row]));
  const nextOpening = new Map(nextOpenings.map((slot) => [slot.subjectId, slot.startedAt]));

  return {
    id: tutor.id,
    userId: tutor.user.id,
    firstName: tutor.user.firstName,
    lastName: tutor.user.lastName,
    verified: true,
    bio: tutor.currentProfileVersion.bio,
    avatarUrl: tutor.currentProfileVersion.avatarUrl,
    introVideoUrl: tutor.currentProfileVersion.introVideoUrl,
    rating: roundedRating(aggregate._avg.ratingStars),
    reviewCount: aggregate._count,
    subjects: tutor.subjects.map((subject) => {
      const stats = ratingBySubject.get(subject.id);
      return {
        ...mapSubject(subject),
        rating: roundedRating(stats?._avg.ratingStars ?? null),
        reviewCount: stats?._count ?? 0,
        nextOpening: nextOpening.get(subject.id)?.toISOString() ?? null,
      };
    }),
    availability: slots.map((slot) => ({
      startedAt: slot.startedAt.toISOString(),
      subjectIds: slot.availabilitySubjects.map(({ subjectId }) => subjectId).sort(),
    })),
    reviews: reviews.map(publicReview),
  };
}

// DISC-4: one subject's public page for a single Bangkok day. The tutor must be listed as on
// the DISC-3 profile and must own the subject; anything else is "unavailable".
export async function getTutorSubjectPage(
  tutorId: string,
  subjectId: string,
  date?: string,
  now = new Date()
) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, tutorId },
    select: {
      ...subjectSelect,
      tutor: {
        select: {
          id: true,
          status: true,
          user: { select: { firstName: true, lastName: true } },
          currentProfileVersion: { select: { status: true } },
        },
      },
    },
  });

  if (
    !subject?.tutor.user ||
    subject.tutor.status !== "PUBLISHED" ||
    subject.tutor.currentProfileVersion.status !== "APPROVED"
  ) {
    throw new SubjectUnavailableError();
  }

  // Read-only like the profile: held slots stay "Not available" until booking releases them.
  const openingsUntil = new Date(now.getTime() + OPENINGS_WINDOW_DAYS * DAY_MS);
  const [openDays, aggregate, reviews] = await Promise.all([
    // One row per Bangkok day with an opening, so the calendar never receives every slot.
    prisma.$queryRaw<Array<{ date: string; firstAt: Date }>>`
      SELECT to_char(slots.started_at + interval '7 hours', 'YYYY-MM-DD') AS "date",
        MIN(slots.started_at) AS "firstAt"
      FROM availabilities slots
      JOIN availability_subjects links ON links.availability_id = slots.availability_id
      WHERE slots.tutor_id = ${tutorId}::uuid AND links.subject_id = ${subjectId}::uuid
        AND slots.is_open = TRUE AND slots.booking_id IS NULL
        AND slots.started_at > ${now} AND slots.started_at < ${openingsUntil}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.review.aggregate({ where: { subjectId }, _avg: { ratingStars: true }, _count: true }),
    prisma.review.findMany({
      where: { subjectId },
      select: publicReviewSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: RECENT_REVIEW_LIMIT,
    }),
  ]);

  const nextOpening = openDays[0]?.firstAt ?? null;
  const day = date ?? bangkokDate(nextOpening ?? now);
  const dayStart = bangkokDayStart(day);
  const dayEnd = new Date(Math.min(dayStart.getTime() + DAY_MS, openingsUntil.getTime()));
  const daySlots = await prisma.availability.findMany({
    where: {
      tutorId,
      isOpen: true,
      bookingId: null,
      startedAt: { gt: now, gte: dayStart, lt: dayEnd },
      availabilitySubjects: { some: { subjectId } },
    },
    select: { startedAt: true },
    orderBy: { startedAt: "asc" },
  });

  return {
    tutor: {
      id: subject.tutor.id,
      firstName: subject.tutor.user.firstName,
      lastName: subject.tutor.user.lastName,
      verified: true,
    },
    subject: {
      ...mapSubject(subject),
      rating: roundedRating(aggregate._avg.ratingStars),
      reviewCount: aggregate._count,
      nextOpening: nextOpening?.toISOString() ?? null,
    },
    date: day,
    openDates: openDays.map((row) => row.date),
    openSlots: daySlots.map((slot) => slot.startedAt.toISOString()),
    reviews: reviews.map(publicReview),
  };
}
