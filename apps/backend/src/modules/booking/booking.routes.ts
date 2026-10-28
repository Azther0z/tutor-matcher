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
  tutorCancel,
  tutorConfirmCompletion,
  tutorNeedsConfirmation,
  tutorCancellationQuote,
  tutorUpcoming,
  updateMeetingLink,
} from "./booking.controller.ts";
import {
  bookingIdParamsSchema,
  cancelBookingSchema,
  createBookingSchema,
  rescheduleBookingSchema,
  subjectIdParamsSchema,
  tutorCancelBookingSchema,
  updateMeetingLinkSchema,
} from "./booking.schema.ts";

export const bookingRouter = Router();
// BOOK-1 endpoints: browse availability, create a booking, view it, and pay.
bookingRouter.get(
  "/subjects/:subjectId/availability",
  validate(subjectIdParamsSchema, "params"),
  subjectAvailability
);
bookingRouter.get("/", list);
// BOOK-4: the tutor's upcoming classes; registered before /:id so "tutor" is never read as an id.
bookingRouter.get("/tutor/upcoming", tutorUpcoming);
bookingRouter.get("/tutor/needs-confirmation", tutorNeedsConfirmation);
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
bookingRouter.post(
  "/:id/confirm-completion",
  validate(bookingIdParamsSchema, "params"),
  tutorConfirmCompletion
);
// BOOK-3 endpoints: reschedule or cancel an existing student booking.
bookingRouter.patch(
  "/:id/reschedule",
  validate(bookingIdParamsSchema, "params"),
  validate(rescheduleBookingSchema),
  reschedule
);
bookingRouter.patch(
  "/:id/meeting-link",
  validate(bookingIdParamsSchema, "params"),
  validate(updateMeetingLinkSchema),
  updateMeetingLink
);
bookingRouter.post(
  "/:id/cancel",
  validate(bookingIdParamsSchema, "params"),
  validate(cancelBookingSchema),
  cancel
);
// BOOK-4 endpoints: the tutor cancels a lesson and the student is refunded in full.
bookingRouter.get(
  "/:id/tutor-cancellation-quote",
  validate(bookingIdParamsSchema, "params"),
  tutorCancellationQuote
);
bookingRouter.post(
  "/:id/tutor-cancel",
  validate(bookingIdParamsSchema, "params"),
  validate(tutorCancelBookingSchema),
  tutorCancel
);
