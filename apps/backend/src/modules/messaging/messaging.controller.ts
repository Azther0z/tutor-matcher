import type { Request, Response } from "express";
import { getInbox, getThread, RecipientNotFoundError, sendMessage } from "./messaging.service.ts";
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

export async function getMessagingThread(req: Request, res: Response) {
  const otherUserId = Number(req.params.userId);

  if (!Number.isInteger(otherUserId)) {
    res.status(400).json({ message: "Invalid user id" });
    return;
  }

  const thread = await getThread(req.user!.sub, otherUserId);
  res.status(200).json(thread);
}
