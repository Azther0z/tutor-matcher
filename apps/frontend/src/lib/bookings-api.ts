import { apiRequest, type ApiFailure } from "@/src/lib/api-client";
import type {
  AvailabilityResponse,
  Booking,
  CancellationQuote,
  CancellationResult,
} from "@/src/types/booking";

export type BookingErrorCode =
  | "SLOT_TAKEN"
  | "INVALID_SLOT_BLOCK"
  | "BOOKING_EXPIRED"
  | "BOOKING_ALREADY_PAID"
  | "BOOKING_NOT_CANCELLABLE"
  | "BOOKING_NOT_RESCHEDULABLE"
  | "INSUFFICIENT_BALANCE"
  | "CANCELLATION_QUOTE_CHANGED"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_FORBIDDEN"
  | "PAYMENT_FAILED";

export class BookingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: BookingErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "BookingApiError";
  }
}

async function request<T>(url: string, init?: Omit<RequestInit, "body"> & { json?: unknown }) {
  // Normalize API failures so pages can handle statuses such as slot conflict 409.
  return apiRequest<T>(url, {
    ...init,
    auth: "optional",
    emptyBody: () => null as T,
    errorMessage: "Something went wrong. Please try again.",
    makeError: ({ body, response }: ApiFailure) => {
      const data = body as {
        code?: BookingErrorCode;
        message?: string;
        error?: string;
        details?: Record<string, unknown>;
      } | null;
      return new BookingApiError(
        data?.message ?? data?.error ?? "Something went wrong. Please try again.",
        response.status,
        data?.code,
        data?.details
      );
    },
  });
}

export async function getAvailability(subjectId: string): Promise<AvailabilityResponse> {
  // Fetch the latest open slots for the selected tutor subject.
  const data = await request<AvailabilityResponse & { data?: AvailabilityResponse }>(
    `/api/bookings/subjects/${encodeURIComponent(subjectId)}/availability`
  );
  return data.data ?? data;
}

export async function createBooking(input: {
  subjectId: string;
  availabilityIds: string[];
  description?: string;
  isTrial: true;
}): Promise<Booking> {
  // Reserve selected slots and create the booking's pending payment.
  const data = await request<Booking & { booking?: Booking }>("/api/bookings", {
    method: "POST",
    json: input,
  });
  return data.booking ?? data;
}

export async function getBooking(id: string): Promise<Booking> {
  const data = await request<Booking & { booking?: Booking }>(
    `/api/bookings/${encodeURIComponent(id)}`
  );
  return data.booking ?? data;
}

export async function getBookings(): Promise<Booking[]> {
  const data = await request<{ bookings: Booking[] }>("/api/bookings");
  return data.bookings;
}

export async function confirmPayment(id: string): Promise<Booking> {
  // Debit the student's balance and move the booking to confirmed.
  const data = await request<Booking & { booking?: Booking }>(
    `/api/bookings/${encodeURIComponent(id)}/confirm-payment`,
    {
      method: "POST",
    }
  );
  return data.booking ?? data;
}

export async function getCancellationQuote(id: string): Promise<CancellationQuote> {
  const data = await request<{ quote: CancellationQuote }>(
    `/api/bookings/${encodeURIComponent(id)}/cancellation-quote`
  );
  return data.quote;
}

export async function cancelBooking(
  id: string,
  input: { reason?: string; quoteToken?: string }
): Promise<CancellationResult> {
  // Apply BOOK-3 policy and preserve the final server-calculated refund details.
  const data = await request<CancellationResult>(`/api/bookings/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    json: input,
  });
  return data;
}

// BOOK-4 lists the signed-in tutor's classes that have not started yet.
export async function getTutorUpcomingBookings(): Promise<Booking[]> {
  const data = await request<{ bookings: Booking[] }>("/api/bookings/tutor/upcoming");
  return data.bookings;
}

export async function getTutorCancellationQuote(id: string): Promise<CancellationQuote> {
  const data = await request<{ quote: CancellationQuote }>(
    `/api/bookings/${encodeURIComponent(id)}/tutor-cancellation-quote`
  );
  return data.quote;
}

export async function cancelBookingAsTutor(
  id: string,
  input: { reason: string; quoteToken?: string }
): Promise<CancellationResult> {
  // BOOK-4 always refunds the student in full; the tutor must give a reason.
  return request<CancellationResult>(`/api/bookings/${encodeURIComponent(id)}/tutor-cancel`, {
    method: "POST",
    json: input,
  });
}

export async function rescheduleBooking(id: string, availabilityIds: string[]): Promise<Booking> {
  // Replace the current lesson slots with the selected alternative slots.
  const data = await request<Booking & { booking?: Booking }>(
    `/api/bookings/${encodeURIComponent(id)}/reschedule`,
    {
      method: "PATCH",
      json: { availabilityIds },
    }
  );
  return data.booking ?? data;
}
