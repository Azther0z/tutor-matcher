import { tutorApi } from "@/src/lib/tutor-application";

// REV-4: the Admin queue of flagged reviews and the Keep or Remove decision.
export type ReviewFlagOutcome = "KEPT" | "REMOVED";
export type ReviewQueueStatus = "PENDING" | "DECIDED";

export type FlaggedReviewFlag = {
  id: string;
  reporter: string | null;
  reason: string;
  createdAt: string;
  outcome: ReviewFlagOutcome | null;
  decidedAt: string | null;
  decidedBy: string | null;
};

export type FlaggedReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: string | null;
  tutor: string | null;
  subject: string;
  removed: { reason: string; removedAt: string; by: string | null } | null;
  pendingFlags: number;
  flags: FlaggedReviewFlag[];
};

export function getFlaggedReviews(status: ReviewQueueStatus) {
  return tutorApi<FlaggedReview[]>(`/api/admin/review-flags?status=${status}`);
}

export function moderateReview(reviewId: string, decision: "KEEP" | "REMOVE", reason?: string) {
  return tutorApi<FlaggedReview>(`/api/admin/reviews/${encodeURIComponent(reviewId)}/moderation`, {
    method: "POST",
    body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
  });
}
