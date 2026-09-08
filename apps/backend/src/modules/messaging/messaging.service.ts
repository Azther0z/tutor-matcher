import { prisma } from "../../lib/db.ts";
import type { SendMessageRequest } from "./messaging.schema.ts";

export class RecipientNotFoundError extends Error {
  constructor() {
    super("Recipient tutor not found");
    this.name = "RecipientNotFoundError";
  }
}

export async function sendMessage(fromUserId: number, input: SendMessageRequest) {
  const recipient = await prisma.user.findUnique({
    where: { id: input.toUserId },
    select: { id: true, isTutor: true },
  });

  if (!recipient?.isTutor) {
    throw new RecipientNotFoundError();
  }

  return prisma.message.create({
    data: {
      fromUserId,
      toUserId: input.toUserId,
      message: input.message,
    },
  });
}

export async function getInbox(userId: number) {
  return prisma.message.findMany({
    where: { toUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}
