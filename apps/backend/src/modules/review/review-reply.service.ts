import { prisma } from "../../lib/db.ts";
import type { ReviewReplyInput, ReviewReplyEditInput } from "./review-reply.schema.ts";

export class ReviewReplyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ReviewReplyError";
  }
}

export async function editReviewReply(
  userId: string,
  reviewId: string,
  input: ReviewReplyEditInput
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tutorId: true } });
  if (!user?.tutorId)
    throw new ReviewReplyError(
      403,
      "TUTOR_REQUIRED",
      "Only the reviewed Tutor can edit this reply."
    );
  const review = await prisma.review.findUnique({
    where: { id: reviewId, removedAt: null },
    select: {
      replyText: true,
      repliedAt: true,
      replyEditedAt: true,
      subject: { select: { tutorId: true } },
    },
  });
  if (!review) throw missingReview();
  if (review.subject.tutorId !== user.tutorId)
    throw new ReviewReplyError(
      403,
      "REVIEW_NOT_YOURS",
      "You can only edit replies to your own reviews."
    );
  if (review.replyText === null || !review.repliedAt)
    throw new ReviewReplyError(
      409,
      "REVIEW_REPLY_NOT_FOUND",
      "This review has no reply to edit. Refresh the page."
    );
  const changed = () =>
    new ReviewReplyError(
      409,
      "REVIEW_REPLY_CHANGED",
      "This reply changed in another tab. Copy your draft, then refresh the page to review the latest reply."
    );
  const version = review.replyEditedAt ?? review.repliedAt;
  if (version.toISOString() !== input.expectedUpdatedAt) throw changed();
  if (review.replyText === input.text)
    return {
      reply: {
        text: review.replyText,
        repliedAt: review.repliedAt.toISOString(),
        ...(review.replyEditedAt ? { editedAt: review.replyEditedAt.toISOString() } : {}),
      },
    };
  const editedAt = new Date(Math.max(Date.now(), version.getTime() + 1));
  const result = await prisma.review.updateMany({
    where: {
      id: reviewId,
      removedAt: null,
      subject: { tutorId: user.tutorId },
      replyText: review.replyText,
      repliedAt: review.repliedAt,
      replyEditedAt: review.replyEditedAt ?? null,
    },
    data: { replyText: input.text, replyEditedAt: editedAt },
  });
  if (result.count === 0) {
    const current = await prisma.review.findUnique({
      where: { id: reviewId, removedAt: null },
      select: { id: true },
    });
    if (!current) throw missingReview();
    throw changed();
  }
  return {
    reply: {
      text: input.text,
      repliedAt: review.repliedAt.toISOString(),
      editedAt: editedAt.toISOString(),
    },
  };
}

const missingReview = () =>
  new ReviewReplyError(404, "REVIEW_NOT_FOUND", "This review no longer exists.");
const alreadyReplied = () =>
  new ReviewReplyError(409, "REVIEW_ALREADY_REPLIED", "You have already replied to this review.");

export async function replyToReview(userId: string, reviewId: string, input: ReviewReplyInput) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tutorId: true } });
  if (!user?.tutorId)
    throw new ReviewReplyError(403, "TUTOR_REQUIRED", "Only the reviewed Tutor can reply.");

  const review = await prisma.review.findUnique({
    where: { id: reviewId, removedAt: null },
    select: { replyText: true, subject: { select: { tutorId: true } } },
  });
  if (!review) throw missingReview();
  if (review.subject.tutorId !== user.tutorId)
    throw new ReviewReplyError(403, "REVIEW_NOT_YOURS", "You can only reply to your own reviews.");
  if (review.replyText !== null) throw alreadyReplied();

  const repliedAt = new Date();
  // A conditional write settles simultaneous replies and a deletion after the initial read.
  const result = await prisma.review.updateMany({
    where: { id: reviewId, removedAt: null, replyText: null, subject: { tutorId: user.tutorId } },
    data: { replyText: input.text, repliedAt },
  });
  if (result.count === 0) {
    const current = await prisma.review.findUnique({
      where: { id: reviewId, removedAt: null },
      select: { id: true },
    });
    if (!current) throw missingReview();
    throw alreadyReplied();
  }
  return { reply: { text: input.text, repliedAt: repliedAt.toISOString() } };
}
