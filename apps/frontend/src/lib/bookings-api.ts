import type { AvailabilityResponse, Booking } from "@/src/types/booking";

export class BookingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

function authHeaders(json = false): HeadersInit {
  // Booking endpoints require the bearer token saved during login.
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  // Normalize API failures so pages can handle statuses such as slot conflict 409.
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => null)) as
    (T & { message?: string; error?: string }) | null;
  if (!response.ok) {
    throw new BookingApiError(
      data?.message ?? data?.error ?? "Something went wrong. Please try again.",
      response.status,
      data
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
  subjectId: number;
  availabilityIds: number[];
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

export async function confirmPayment(id: number): Promise<Booking> {
  // Debit the student's balance and move the booking to confirmed.
  const data = await request<Booking & { booking?: Booking }>(
    `/api/bookings/${id}/confirm-payment`,
    {
      method: "POST",
      headers: authHeaders(true),
    }
  );
  return data.booking ?? data;
}

export async function cancelBooking(id: number, reason?: string): Promise<Booking> {
  // Apply BOOK-3 cancellation policy and return the updated booking.
  const data = await request<Booking & { booking?: Booking }>(`/api/bookings/${id}/cancel`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ reason: reason || undefined }),
  });
  return data.booking ?? data;
}

export async function rescheduleBooking(id: number, availabilityIds: number[]): Promise<Booking> {
  // Replace the current lesson slots with the selected alternative slots.
  const data = await request<Booking & { booking?: Booking }>(`/api/bookings/${id}/reschedule`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify({ availabilityIds }),
  });
  return data.booking ?? data;
}
