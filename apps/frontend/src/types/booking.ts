export type BookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

// One availability record represents a selectable 30-minute lesson slot.
export type AvailabilitySlot = {
  id: string;
  startedAt: string;
  available?: boolean;
};

// Subject data includes the tutor and rate needed by both booking pages.
export type BookingSubject = {
  id: string;
  name: string;
  description?: string | null;
  hourlyRate: string;
  format: "ONLINE";
  tutor: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
};

export type AvailabilityResponse = {
  acceptingBookings?: boolean;
  subject: BookingSubject;
  slots: AvailabilitySlot[];
};

export type BookingPayment = {
  status: "PENDING" | "HOLDING" | "COMPLETED" | "CANCELLED" | null;
  amountDue: string;
  walletBalance: string | null;
  shortfall: string | null;
  canPay: boolean;
  expiresAt: string | null;
};

export type BookingActions = {
  canPay: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  canTutorCancel: boolean;
  canEditMeetingLink: boolean;
  canJoin: boolean;
  canConfirmCompletion: boolean;
};

export type CancellationQuote = {
  token: string;
  generatedAt: string;
  bookingId: string;
  lateCancellation: boolean;
  policyWindowHours: number;
  refundRate: number;
  originalAmount: string;
  refundAmount: string;
  cancellationFee: string;
};

// The cancellation endpoint returns the final server-calculated refund as well as the booking.
export type CancellationResult = {
  booking: Booking;
  refund: {
    amount: string;
    lateCancellation: boolean;
    rate: number;
    cancellationFee: string;
  };
};

// Booking is the stable, intentionally limited DTO shared by all booking endpoints.
export type Booking = {
  id: string;
  status: BookingStatus;
  viewerRole: "STUDENT" | "TUTOR";
  description?: string | null;
  isTrial: boolean;
  totalAmount: string;
  startedAt: string;
  endedAt: string;
  paymentExpiresAt: string | null;
  zoomMeetingUrl?: string | null;
  customMeetingUrl: string | null;
  effectiveMeetingUrl: string | null;
  meetingLinkUpdatedAt: string | null;
  createdAt: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: "STUDENT" | "TUTOR" | null;
  student: {
    id: string;
    name: string;
  };
  subject: BookingSubject;
  availabilities: AvailabilitySlot[];
  payment: BookingPayment;
  actions: BookingActions;
};
