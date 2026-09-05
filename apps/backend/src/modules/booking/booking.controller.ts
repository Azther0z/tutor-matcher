import type { Request, Response } from "express";
import {
  cancelBooking,
  BookingConflictError,
  BookingForbiddenError,
  BookingNotFoundError,
  BookingPaymentError,
  confirmBookingPayment,
  createBooking,
  getBooking,
  getSubjectAvailability,
  listBookings,
  rescheduleBooking,
} from "./booking.service.ts";
import type {
  CancelBookingInput,
  CreateBookingInput,
  RescheduleBookingInput,
} from "./booking.schema.ts";

async function sendError(error: unknown, res: Response) {
  // Convert booking-domain errors into stable HTTP responses for the frontend.
  if (error instanceof BookingNotFoundError)
    return res.status(404).json({ code: error.code, message: error.message });
  if (error instanceof BookingForbiddenError)
    return res.status(403).json({ code: error.code, message: error.message });
  if (error instanceof BookingPaymentError)
    return res.status(402).json({ code: error.code, message: error.message });
  if (error instanceof BookingConflictError) {
    let availability;
    // Include fresh availability so a 409 response can immediately refresh the UI.
    if (error.subjectId > 0)
      try {
        availability = await getSubjectAvailability(error.subjectId);
      } catch {
        /* unavailable subject */
      }
    return res.status(409).json({ code: error.code, message: error.message, availability });
  }
  throw error;
}
export async function subjectAvailability(req: Request, res: Response) {
  try {
    res.json(await getSubjectAvailability(Number(req.params.subjectId)));
  } catch (e) {
    await sendError(e, res);
  }
}
export async function create(req: Request, res: Response) {
  try {
    // The authentication middleware supplies the current student's user id.
    res.status(201).json({
      booking: await createBooking(req.user!.sub, req.body as CreateBookingInput),
      notificationsQueued: true,
    });
  } catch (e) {
    await sendError(e, res);
  }
}
export async function detail(req: Request, res: Response) {
  try {
    res.json({ booking: await getBooking(req.user!.sub, Number(req.params.id)) });
  } catch (e) {
    await sendError(e, res);
  }
}
export async function list(req: Request, res: Response) {
  try {
    res.json({ bookings: await listBookings(req.user!.sub) });
  } catch (e) {
    await sendError(e, res);
  }
}
export async function confirmPayment(req: Request, res: Response) {
  try {
    // Confirm payment and return the latest booking state to the detail page.
    res.json({
      booking: await confirmBookingPayment(req.user!.sub, Number(req.params.id)),
      notificationsQueued: true,
    });
  } catch (e) {
    await sendError(e, res);
  }
}
export async function reschedule(req: Request, res: Response) {
  try {
    // The service validates the 24-hour policy and performs the atomic slot swap.
    res.json({
      booking: await rescheduleBooking(
        req.user!.sub,
        Number(req.params.id),
        req.body as RescheduleBookingInput
      ),
      notificationsQueued: true,
    });
  } catch (e) {
    await sendError(e, res);
  }
}
export async function cancel(req: Request, res: Response) {
  try {
    // Return both the cancelled booking and its calculated refund summary.
    res.json({
      ...(await cancelBooking(
        req.user!.sub,
        Number(req.params.id),
        req.body as CancelBookingInput
      )),
      notificationsQueued: true,
    });
  } catch (e) {
    await sendError(e, res);
  }
}
