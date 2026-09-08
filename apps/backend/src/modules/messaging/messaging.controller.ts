import type { Request, Response } from "express";
import { getInbox, RecipientNotFoundError, sendMessage } from "./messaging.service.ts";
import type { SendMessageRequest } from "./messaging.schema.ts";

export async function postMessage(req: Request, res: Response) {
  try {
    const message = await sendMessage(req.user!.sub, req.body as SendMessageRequest);
    res.status(201).json(message);
  } catch (error) {
    if (error instanceof RecipientNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    throw error;
  }
}

export async function getMessagingInbox(req: Request, res: Response) {
  const inbox = await getInbox(req.user!.sub);
  res.status(200).json(inbox);
}
