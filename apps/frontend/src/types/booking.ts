export type BookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

// One availability record represents a selectable 30-minute lesson slot.
export type AvailabilitySlot = {
  id: number;
  startedAt: string;
  available?: boolean;
};

// Subject data includes the tutor and rate needed by both booking pages.
export type BookingSubject = {
  id: number;
  name: string;
  description?: string | null;
  hourlyRate: number | string;
  tutor: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  };
};

export type AvailabilityResponse = {
  subject: BookingSubject;
  slots: AvailabilitySlot[];
};

// Booking mirrors the backend detail response used by BOOK-1 and BOOK-3.
export type Booking = {
  id: number;
  status: BookingStatus;
  description?: string | null;
  isTrial: boolean;
  totalAmount: number | string;
  startedAt: string;
  endedAt: string;
  zoomMeetingUrl?: string | null;
  createdAt?: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  subject: BookingSubject;
  availabilities: AvailabilitySlot[];
  paymentStatus?: string | null;
  refundAmount?: number | null;
  cancellationFee?: number | null;
};
