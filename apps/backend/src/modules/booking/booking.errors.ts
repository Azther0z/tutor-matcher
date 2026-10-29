export type BookingErrorCode =
  | "BOOKING_NOT_FOUND"
  | "SUBJECT_NOT_FOUND"
  | "BOOKING_FORBIDDEN"
  | "SLOT_TAKEN"
  | "INVALID_SLOT_BLOCK"
  | "BOOKING_EXPIRED"
  | "BOOKING_ALREADY_PAID"
  | "BOOKING_NOT_CANCELLABLE"
  | "BOOKING_NOT_RESCHEDULABLE"
  | "PAYMENT_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "CANCELLATION_QUOTE_CHANGED";

export class BookingDomainError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "BookingDomainError";
  }
}

export class BookingNotFoundError extends BookingDomainError {
  constructor(
    message = "Booking not found",
    code: "BOOKING_NOT_FOUND" | "SUBJECT_NOT_FOUND" = "BOOKING_NOT_FOUND"
  ) {
    super(code, 404, message);
  }
}

export class BookingForbiddenError extends BookingDomainError {
  constructor(message: string) {
    super("BOOKING_FORBIDDEN", 403, message);
  }
}

type ConflictCode = Exclude<
  BookingErrorCode,
  | "BOOKING_NOT_FOUND"
  | "SUBJECT_NOT_FOUND"
  | "BOOKING_FORBIDDEN"
  | "PAYMENT_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
>;

export class BookingConflictError extends BookingDomainError {
  constructor(code: ConflictCode, message: string, details?: Record<string, unknown>) {
    super(code, 409, message, details);
  }
}

export class BookingPaymentError extends BookingDomainError {
  constructor(
    code: "PAYMENT_NOT_FOUND" | "INSUFFICIENT_BALANCE",
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, code === "INSUFFICIENT_BALANCE" ? 402 : 409, message, details);
  }
}
