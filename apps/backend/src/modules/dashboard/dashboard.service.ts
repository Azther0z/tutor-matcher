import { prisma } from "../../lib/db.ts";

export class DashboardError extends Error {
  readonly status = 403;
}

const DAY_MS = 86_400_000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function bangkokWeekWindow(now: Date) {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const mondayOffset = (local.getUTCDay() + 6) % 7;
  const start = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - mondayOffset) -
      BANGKOK_OFFSET_MS
  );
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

export async function getTutorDashboard(userId: string, now = new Date()) {
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { tutorId: true },
  });
  if (!owner?.tutorId)
    throw new DashboardError("Only approved Tutors can view teaching statistics");

  const tutorId = owner.tutorId;
  const ownedBookings = { subject: { tutorId } };
  const ownedReviews = { subject: { tutorId } };
  const week = bangkokWeekWindow(now);
  const [statuses, students, completedStudents, classesThisWeek, rating, recentReviews] =
    await Promise.all([
      prisma.booking.groupBy({
        by: ["status"],
        where: ownedBookings,
        _count: true,
      }),
      prisma.booking.groupBy({
        by: ["userId"],
        where: { ...ownedBookings, status: { in: ["CONFIRMED", "COMPLETED"] } },
        _count: true,
      }),
      prisma.booking.groupBy({
        by: ["userId"],
        where: { ...ownedBookings, status: "COMPLETED" },
        _count: true,
      }),
      prisma.booking.count({
        where: {
          ...ownedBookings,
          status: { in: ["CONFIRMED", "COMPLETED"] },
          startedAt: { gte: week.start, lt: week.end },
        },
      }),
      prisma.review.aggregate({
        where: ownedReviews,
        _avg: { ratingStars: true },
        _count: true,
      }),
      prisma.review.findMany({
        where: ownedReviews,
        select: {
          id: true,
          ratingStars: true,
          text: true,
          createdAt: true,
          replyText: true,
          repliedAt: true,
          replyEditedAt: true,
          subject: { select: { id: true, name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
    ]);

  const count = (status: string) => statuses.find((group) => group.status === status)?._count ?? 0;
  const returningStudents = completedStudents.filter((group) => group._count >= 2).length;
  return {
    tutorId,
    classesThisWeek,
    week: { start: week.start.toISOString(), end: week.end.toISOString() },
    lessons: {
      completed: count("COMPLETED"),
      confirmed: count("CONFIRMED"),
      pendingPayment: count("PENDING_PAYMENT"),
      cancelled: count("CANCELLED"),
    },
    students: {
      total: students.length,
      withCompletedLessons: completedStudents.length,
      returning: returningStudents,
      returningRate:
        completedStudents.length === 0
          ? null
          : Math.round((returningStudents / completedStudents.length) * 100),
    },
    reviews: {
      count: rating._count,
      averageRating:
        rating._avg.ratingStars === null ? null : Math.round(rating._avg.ratingStars * 10) / 10,
      recent: recentReviews.map((review) => {
        const lastInitial = Array.from(review.user.lastName.trim())[0];
        return {
          id: review.id,
          ratingStars: review.ratingStars,
          text: review.text,
          createdAt: review.createdAt.toISOString(),
          reply:
            review.replyText && review.repliedAt
              ? {
                  text: review.replyText,
                  repliedAt: review.repliedAt.toISOString(),
                  ...(review.replyEditedAt ? { editedAt: review.replyEditedAt.toISOString() } : {}),
                }
              : null,
          subject: review.subject,
          studentName: `${review.user.firstName}${lastInitial ? ` ${lastInitial}.` : ""}`.trim(),
        };
      }),
    },
  };
}
