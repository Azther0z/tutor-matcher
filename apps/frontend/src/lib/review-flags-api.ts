import { getAuthToken } from "@/src/lib/auth";

export class ReviewFlagApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ReviewFlagApiError";
  }
}

// REV-3: a signed-in member flags a review's comment so an Admin can review it.
export async function flagReview(reviewId: string, reason: string) {
  const token = getAuthToken();
  const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/flags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ reason }),
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok)
    throw new ReviewFlagApiError(
      body.message || "Could not flag this review. Try again.",
      body.code
    );
}
