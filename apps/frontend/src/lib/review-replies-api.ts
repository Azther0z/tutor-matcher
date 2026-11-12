import { getAuthToken } from "@/src/lib/auth";

export type PublicReviewReply = { text: string; repliedAt: string; editedAt?: string | null };

export class ReviewReplyApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ReviewReplyApiError";
  }
}

export async function postReviewReply(
  reviewId: string,
  text: string,
  existing?: PublicReviewReply
) {
  const token = getAuthToken();
  const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, {
    method: existing ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      text,
      ...(existing ? { expectedUpdatedAt: existing.editedAt ?? existing.repliedAt } : {}),
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    reply?: PublicReviewReply;
    message?: string;
    code?: string;
  };
  if (!response.ok || !body.reply)
    throw new ReviewReplyApiError(
      body.message || "Could not publish your reply. Try again.",
      body.code
    );
  return body.reply;
}
