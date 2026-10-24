import { Router } from "express";
import { validate } from "../../middleware/validate.ts";
import { banks, create, list, remove, setDefault } from "./payout-account.controller.ts";
import { createPayoutAccountSchema, payoutAccountIdParamsSchema } from "./payout-account.schema.ts";

export const payoutAccountRouter = Router();

payoutAccountRouter.get("/", list);
// PROF-7: any user manages their own accounts; another user's id is not found.
payoutAccountRouter.get("/banks", banks);
payoutAccountRouter.post("/", validate(createPayoutAccountSchema), create);
payoutAccountRouter.patch(
  "/:id/default",
  validate(payoutAccountIdParamsSchema, "params"),
  setDefault
);
payoutAccountRouter.delete("/:id", validate(payoutAccountIdParamsSchema, "params"), remove);
