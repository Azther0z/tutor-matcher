import { prisma } from "../../lib/db.ts";
import type { SendMessageRequest } from "./messaging.schema.ts";

export class RecipientNotFoundError extends Error {
  constructor() {
    super("Recipient not found");
    this.name = "RecipientNotFoundError";
  }
}

export async function sendMessage(fromUserId: number, input: SendMessageRequest) {
  // Any existing user may be messaged here — a Tutor replying to a Student is
  // just as valid as the Student who started the conversation. Restricting a
  // *new* conversation to Students messaging Tutors is enforced by the
  // frontend, which only ever offers a Tutor's userId to message in the first
  // place (via the discovery lookup on the tutor profile page).
  const recipient = await prisma.user.findUnique({
    where: { id: input.toUserId },
    select: { id: true },
  });

  if (!recipient) {
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

export async function getThread(userId: number, otherUserId: number) {
  return prisma.message.findMany({
    where: {
      OR: [
        { fromUserId: userId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}
