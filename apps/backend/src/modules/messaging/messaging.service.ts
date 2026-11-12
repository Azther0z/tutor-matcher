import { prisma } from "../../lib/db.ts";
import type { SendMessageRequest } from "./messaging.schema.ts";

export class RecipientNotFoundError extends Error {
  constructor() {
    super("Recipient not found");
    this.name = "RecipientNotFoundError";
  }
}

export async function sendMessage(fromUserId: string, input: SendMessageRequest) {
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

export async function getInbox(userId: string) {
  return prisma.message.findMany({
    where: { toUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

const participantSelect = { id: true, firstName: true, lastName: true } as const;

// MSG-1: one entry per person the user has written to or heard from, newest first, so a
// conversation the user started shows up even before the other person replies.
export async function getConversations(userId: string) {
  const messages = await prisma.message.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { fromUser: { select: participantSelect }, toUser: { select: participantSelect } },
  });

  const conversations = new Map<
    string,
    { userId: string; name: string; lastMessage: string; lastMessageAt: Date; sentByMe: boolean }
  >();
  for (const message of messages) {
    const sentByMe = message.fromUserId === userId;
    const other = sentByMe ? message.toUser : message.fromUser;
    if (conversations.has(other.id)) continue;
    conversations.set(other.id, {
      userId: other.id,
      name: `${other.firstName} ${other.lastName}`.trim(),
      lastMessage: message.message,
      lastMessageAt: message.createdAt,
      sentByMe,
    });
  }
  return [...conversations.values()];
}

export async function getThread(userId: string, otherUserId: string) {
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
