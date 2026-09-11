import { getAuthToken } from "@/src/lib/auth";
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

function authHeaders(json = false): HeadersInit {
  // Booking endpoints require the bearer token saved during login.
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  // Normalize API failures so pages can handle statuses such as slot conflict 409.
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => null)) as
    | (T & {
        code?: BookingErrorCode;
        message?: string;
        error?: string;
        details?: Record<string, unknown>;
      })
    | null;
  if (!response.ok) {
    throw new BookingApiError(
      data?.message ?? data?.error ?? "Something went wrong. Please try again.",
      response.status,
      data?.code,
      data?.details
    );
  }
  return data as T;
}

export async function getAvailability(subjectId: string): Promise<AvailabilityResponse> {
  // Fetch the latest open slots for the selected tutor subject.
  const data = await request<AvailabilityResponse & { data?: AvailabilityResponse }>(
    `/api/bookings/subjects/${encodeURIComponent(subjectId)}/availability`,
    { headers: authHeaders() }
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
    headers: authHeaders(true),
    body: JSON.stringify(input),
  });
  return data.booking ?? data;
}

export async function getBooking(id: string): Promise<Booking> {
  const data = await request<Booking & { booking?: Booking }>(
    `/api/bookings/${encodeURIComponent(id)}`,
    { headers: authHeaders() }
  );
  return data.booking ?? data;
}

export async function getBookings(): Promise<Booking[]> {
  const data = await request<{ bookings: Booking[] }>("/api/bookings", {
    headers: authHeaders(),
  });
  return data.bookings;
}

export async function confirmPayment(id: string): Promise<Booking> {
  // Debit the student's balance and move the booking to confirmed.
  const data = await request<Booking & { booking?: Booking }>(
    `/api/bookings/${encodeURIComponent(id)}/confirm-payment`,
    {
      method: "POST",
      headers: authHeaders(true),
    }
  );
  return data.booking ?? data;
}

export async function getCancellationQuote(id: string): Promise<CancellationQuote> {
  const data = await request<{ quote: CancellationQuote }>(
    `/api/bookings/${encodeURIComponent(id)}/cancellation-quote`,
    { headers: authHeaders() }
  );
  return data.quote;
}

export async function cancelBooking(
  id: string,
  input: { reason?: string; quoteToken?: string }
): Promise<CancellationResult> {
  // Apply BOOK-3 policy and preserve the final server-calculated refund details.
  const data = await request<CancellationResult>(
    `/api/bookings/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(input),
    }
  );
  return data;
}

export async function rescheduleBooking(id: string, availabilityIds: string[]): Promise<Booking> {
  // Replace the current lesson slots with the selected alternative slots.
  const data = await request<Booking & { booking?: Booking }>(
    `/api/bookings/${encodeURIComponent(id)}/reschedule`,
    {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({ availabilityIds }),
    }
  );
  return data.booking ?? data;
}
