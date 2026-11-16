import { prisma } from "../../lib/db.ts";
import { sendReviewModerationEmail } from "../../lib/email.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import type { ReviewFlagListStatus, ReviewModerationInput } from "./review-moderation.schema.ts";
import { countedReview } from "./review-visibility.ts";

export class ReviewModerationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ReviewModerationError";
  }
}

// Admin rights are read from the database on each request, not trusted from the token.
async function requireAdmin(client: Pick<Prisma.TransactionClient, "user">, adminId: string) {
  const admin = await client.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
  if (!admin?.isAdmin) {
    throw new ReviewModerationError(403, "ADMIN_REQUIRED", "Administrator access required");
  }
}

const nameSelect = { firstName: true, lastName: true } as const;
const fullName = (person: { firstName: string; lastName: string } | null | undefined) =>
  person ? `${person.firstName} ${person.lastName}`.trim() : null;

const flaggedReviewSelect = {
  id: true,
  ratingStars: true,
  text: true,
  createdAt: true,
  removedAt: true,
  removalReason: true,
  user: { select: nameSelect },
  removedBy: { select: nameSelect },
  subject: { select: { name: true, tutor: { select: { user: { select: nameSelect } } } } },
  flags: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      reason: true,
      createdAt: true,
      outcome: true,
      decidedAt: true,
      reporter: { select: nameSelect },
      decidedBy: { select: nameSelect },
    },
  },
} as const satisfies Prisma.ReviewSelect;

type FlaggedReviewRow = Prisma.ReviewGetPayload<{ select: typeof flaggedReviewSelect }>;

function flaggedReview(review: FlaggedReviewRow) {
  return {
    id: review.id,
    rating: review.ratingStars,
    comment: review.text,
    createdAt: review.createdAt.toISOString(),
    author: fullName(review.user),
    tutor: fullName(review.subject.tutor.user),
    subject: review.subject.name,
    removed: review.removedAt
      ? {
          reason: review.removalReason ?? "",
          removedAt: review.removedAt.toISOString(),
          by: fullName(review.removedBy),
        }
      : null,
    pendingFlags: review.flags.filter((flag) => flag.outcome === null).length,
    flags: review.flags.map((flag) => ({
      id: flag.id,
      reporter: fullName(flag.reporter),
      reason: flag.reason,
      createdAt: flag.createdAt.toISOString(),
      outcome: flag.outcome,
      decidedAt: flag.decidedAt?.toISOString() ?? null,
      decidedBy: fullName(flag.decidedBy),
    })),
  };
}

// REV-4: the Admin queue. Pending lists public reviews with undecided flags, the longest
// waiting first; Decided lists reviews with decisions, the most recent first.
export async function listFlaggedReviews(adminId: string, status: ReviewFlagListStatus) {
  await requireAdmin(prisma, adminId);
  const reviews = await prisma.review.findMany({
    where:
      status === "PENDING"
        ? { ...countedReview, flags: { some: { outcome: null } } }
        : { flags: { some: { outcome: { not: null } } } },
    select: flaggedReviewSelect,
  });

  const waitingSince = (review: FlaggedReviewRow) =>
    Math.min(
      ...review.flags.filter((flag) => flag.outcome === null).map((f) => f.createdAt.getTime())
    );
  const decidedAt = (review: FlaggedReviewRow) =>
    Math.max(...review.flags.map((flag) => flag.decidedAt?.getTime() ?? 0));
  const ordered =
    status === "PENDING"
      ? reviews.sort((a, b) => waitingSince(a) - waitingSince(b))
      : reviews.sort((a, b) => decidedAt(b) - decidedAt(a));
  return ordered.map(flaggedReview);
}

// REV-4: one decision covers every pending flag on the review. Keep leaves it published;
// Remove hides the whole review everywhere. Reporters, and on removal the author, are told.
export async function moderateReview(
  adminId: string,
  reviewId: string,
  { decision, reason }: ReviewModerationInput,
  now = new Date()
) {
  const outcome = decision === "KEEP" ? ("KEPT" as const) : ("REMOVED" as const);
  const decided = await prisma.$transaction(async (tx) => {
    await requireAdmin(tx, adminId);
    // Lock the review so two Admins deciding at once cannot both act on its flags.
    await tx.$queryRaw`SELECT review_id FROM reviews WHERE review_id = ${reviewId}::uuid FOR UPDATE`;
    const review = await tx.review.findUnique({
      where: { id: reviewId },
      select: {
        removedAt: true,
        user: { select: { email: true, firstName: true } },
        subject: { select: { name: true, tutor: { select: { user: { select: nameSelect } } } } },
        flags: {
          where: { outcome: null },
          select: { reporter: { select: { email: true, firstName: true } } },
        },
      },
    });
    if (!review) {
      throw new ReviewModerationError(404, "REVIEW_NOT_FOUND", "This review no longer exists.");
    }
    if (review.removedAt || review.flags.length === 0) {
      throw new ReviewModerationError(409, "NO_PENDING_FLAGS", "This review has no pending flags.");
    }

    await tx.reviewFlag.updateMany({
      where: { reviewId, outcome: null },
      data: { outcome, decidedAt: now, decidedById: adminId },
    });
    if (outcome === "REMOVED") {
      await tx.review.update({
        where: { id: reviewId },
        data: { removedAt: now, removedById: adminId, removalReason: reason },
      });
    }
    return review;
  });

  const notice = {
    outcome,
    subjectName: decided.subject.name,
    tutorName: fullName(decided.subject.tutor.user) ?? "the Tutor",
  };
  const recipients = [
    ...decided.flags.map(({ reporter }) => ({ ...reporter, audience: "REPORTER" as const })),
    ...(outcome === "REMOVED" ? [{ ...decided.user, audience: "AUTHOR" as const }] : []),
  ];
  for (const { email, firstName, audience } of recipients) {
    try {
      await sendReviewModerationEmail({
        to: email,
        firstName,
        audience,
        ...notice,
        reason: audience === "AUTHOR" ? reason : null,
      });
    } catch (error) {
      // The decision already stands; a failed notice must not undo it.
      console.error("Could not send the review moderation email", error);
    }
  }

  const review = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    select: flaggedReviewSelect,
  });
  return flaggedReview(review);
}
