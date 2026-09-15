import type { Request, Response } from "express";
import {
  BookingDomainError,
  cancelBooking,
  confirmBookingPayment,
  createBooking,
  getBooking,
  getCancellationQuote,
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
  if (!(error instanceof BookingDomainError)) throw error;
  let details = error.details;
  // BOOK-1 refreshes availability only for a real slot race, not every 409 response.
  if (error.code === "SLOT_TAKEN" && typeof details?.subjectId === "string") {
    try {
      details = {
        ...details,
        availability: await getSubjectAvailability(details.subjectId),
      };
    } catch {
      // Preserve the original domain error if the subject can no longer be loaded.
    }
  }
  return res.status(error.status).json({
    code: error.code,
    message: error.message,
    ...(details ? { details } : {}),
  });
}

export async function subjectAvailability(req: Request, res: Response) {
  try {
    res.json(await getSubjectAvailability(req.params.subjectId as string));
  } catch (error) {
    await sendError(error, res);
  }
}

export async function create(req: Request, res: Response) {
  try {
    res.status(201).json({
      booking: await createBooking(req.user!.sub, req.body as CreateBookingInput),
    });
  } catch (error) {
    await sendError(error, res);
  }
}

export async function detail(req: Request, res: Response) {
  try {
    res.json({ booking: await getBooking(req.user!.sub, req.params.id as string) });
  } catch (error) {
    await sendError(error, res);
  }
}

export async function list(req: Request, res: Response) {
  try {
    res.json({ bookings: await listBookings(req.user!.sub) });
  } catch (error) {
    await sendError(error, res);
  }
}

export async function confirmPayment(req: Request, res: Response) {
  try {
    res.json({ booking: await confirmBookingPayment(req.user!.sub, req.params.id as string) });
  } catch (error) {
    await sendError(error, res);
  }
}

export async function reschedule(req: Request, res: Response) {
  try {
    res.json({
      booking: await rescheduleBooking(
        req.user!.sub,
        req.params.id as string,
        req.body as RescheduleBookingInput
      ),
    });
  } catch (error) {
    await sendError(error, res);
  }
}

export async function cancellationQuote(req: Request, res: Response) {
  try {
    res.json({ quote: await getCancellationQuote(req.user!.sub, req.params.id as string) });
  } catch (error) {
    await sendError(error, res);
  }
}

export async function cancel(req: Request, res: Response) {
  try {
    res.json(
      await cancelBooking(req.user!.sub, req.params.id as string, req.body as CancelBookingInput)
    );
  } catch (error) {
    await sendError(error, res);
  }
}
