import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  cancel,
  cancellationQuote,
  confirmPayment,
  create,
  detail,
  list,
  reschedule,
  subjectAvailability,
} from "./booking.controller.ts";
import {
  bookingIdParamsSchema,
  cancelBookingSchema,
  createBookingSchema,
  listBookingsQuerySchema,
  rescheduleBookingSchema,
  subjectIdParamsSchema,
} from "./booking.schema.ts";

export const bookingRouter = Router();
// BOOK-1 endpoints: browse availability, create a booking, view it, and pay.
bookingRouter.get(
  "/subjects/:subjectId/availability",
  validate(subjectIdParamsSchema, "params"),
  subjectAvailability
);
// BOOK-4: ?role=tutor lists lessons booked against the caller's own subjects.
bookingRouter.get("/", validate(listBookingsQuerySchema, "query"), list);
bookingRouter.post("/", validate(createBookingSchema), create);
bookingRouter.get("/:id", validate(bookingIdParamsSchema, "params"), detail);
bookingRouter.get(
  "/:id/cancellation-quote",
  validate(bookingIdParamsSchema, "params"),
  cancellationQuote
);
bookingRouter.post(
  "/:id/confirm-payment",
  validate(bookingIdParamsSchema, "params"),
  confirmPayment
);
// BOOK-3 endpoints: reschedule or cancel an existing student booking.
bookingRouter.patch(
  "/:id/reschedule",
  validate(bookingIdParamsSchema, "params"),
  validate(rescheduleBookingSchema),
  reschedule
);
bookingRouter.post(
  "/:id/cancel",
  validate(bookingIdParamsSchema, "params"),
  validate(cancelBookingSchema),
  cancel
);
