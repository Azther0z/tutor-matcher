import { Router, type Response } from "express";
import { validate } from "../../middleware/validate.ts";
import {
  calendarQuerySchema,
  dayParamsSchema,
  saveSlotSchema,
  slotParamsSchema,
} from "./availability.schema.ts";
import { AvailabilityError, getCalendar, getDay, saveSlot } from "./availability.service.ts";

export const availabilityRouter = Router();

function handleError(error: unknown, res: Response) {
  if (!(error instanceof AvailabilityError)) throw error;
  res.status(error.status).json({ message: error.message });
}

availabilityRouter.get("/calendar", validate(calendarQuerySchema, "query"), async (req, res) => {
  try {
    const { from, to } = calendarQuerySchema.parse(req.query);
    res.json(await getCalendar(req.user!.sub, from, to));
  } catch (error) {
    handleError(error, res);
  }
});

availabilityRouter.get("/:date", validate(dayParamsSchema, "params"), async (req, res) => {
  try {
    res.json(await getDay(req.user!.sub, dayParamsSchema.parse(req.params).date));
  } catch (error) {
    handleError(error, res);
  }
});

availabilityRouter.put(
  "/:date/:time",
  validate(slotParamsSchema, "params"),
  validate(saveSlotSchema),
  async (req, res) => {
    try {
      const { date, time } = slotParamsSchema.parse(req.params);
      res.json(await saveSlot(req.user!.sub, date, time, saveSlotSchema.parse(req.body)));
    } catch (error) {
      handleError(error, res);
    }
  }
);
