import { Router } from "express";
import { list } from "./payout-account.controller.ts";

export const payoutAccountRouter = Router();

payoutAccountRouter.get("/", list);
