import { prisma } from "../../lib/db.ts";
import type { AccountActionType } from "../../generated/prisma/client.ts";

// SAFE-1: an account is restricted by any ban, or by a suspension that has not ended yet.
export type AccountRestriction = { type: AccountActionType; reason: string; endsAt: Date | null };

export const activeRestrictionWhere = (now: Date) => ({
  OR: [{ type: "BAN" as const }, { type: "SUSPEND" as const, endsAt: { gt: now } }],
});

// A ban (no end) comes first; otherwise the suspension that ends last.
export const restrictionOrder = [
  { endsAt: { sort: "desc" as const, nulls: "first" as const } },
  { createdAt: "desc" as const },
];

export const restrictionSelect = { type: true, reason: true, endsAt: true } as const;

export async function findAccountRestriction(
  userId: string,
  now = new Date()
): Promise<AccountRestriction | null> {
  return prisma.accountAction.findFirst({
    where: { userId, ...activeRestrictionWhere(now) },
    orderBy: restrictionOrder,
    select: restrictionSelect,
  });
}

const bangkokTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});
export const formatRestrictionEnd = (endsAt: Date) =>
  `${bangkokTime.format(endsAt)} (Bangkok time)`;

export function restrictionMessage({ type, reason, endsAt }: AccountRestriction) {
  return type === "BAN" || !endsAt
    ? `This account has been banned. Reason: ${reason}`
    : `This account is suspended until ${formatRestrictionEnd(endsAt)}. Reason: ${reason}`;
}

export function publicRestriction({ type, reason, endsAt }: AccountRestriction) {
  return { type, reason, endsAt: endsAt?.toISOString() ?? null };
}

// The 403 body for a restricted account, so the app can sign it out and show why.
export function restrictionResponse(restriction: AccountRestriction) {
  return {
    code: "ACCOUNT_RESTRICTED",
    message: restrictionMessage(restriction),
    restriction: publicRestriction(restriction),
  };
}

export class AccountRestrictedError extends Error {
  constructor(public readonly restriction: AccountRestriction) {
    super(restrictionMessage(restriction));
    this.name = "AccountRestrictedError";
  }
}
