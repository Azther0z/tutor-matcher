import { getAuthToken } from "@/src/lib/auth";
import type { BookingReview } from "@/src/types/booking";

export class ReviewApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ReviewApiError";
  }
}

// REV-1: publish a review of the Student's own completed lesson.
export async function submitReview(input: {
  bookingId: string;
  rating: number;
  comment?: string;
}): Promise<BookingReview> {
  const token = getAuthToken();
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => ({}))) as {
    review?: BookingReview;
    message?: string;
    code?: string;
  };
  if (!response.ok || !body.review) {
    throw new ReviewApiError(
      body.message || "Could not publish your review. Please try again.",
      response.status,
      body.code
    );
  }
  return body.review;
}
