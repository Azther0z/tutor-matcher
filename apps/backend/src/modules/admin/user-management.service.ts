import { prisma } from "../../lib/db.ts";
import { sendAccountActionEmail } from "../../lib/email.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import type { AccountActionRequest, UserSearchQuery } from "./admin.schema.ts";
import {
  activeRestrictionWhere,
  formatRestrictionEnd,
  publicRestriction,
  restrictionOrder,
  restrictionSelect,
  type AccountRestriction,
} from "./account-actions.ts";

export class UserManagementError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "UserManagementError";
  }
}

const PAGE_SIZE = 20;
const DAY_MS = 86_400_000;

const managedUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  isAdmin: true,
  tutorId: true,
} as const;

type ManagedUserRow = Prisma.UserGetPayload<{ select: typeof managedUserSelect }>;

// Admin rights are read from the database on each request, not trusted from the token.
async function requireAdmin(db: Pick<Prisma.TransactionClient, "user">, adminId: string) {
  const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
  if (!admin?.isAdmin) throw new UserManagementError(403, "Administrator access required");
}

function managedUser(user: ManagedUserRow, restriction: AccountRestriction | null) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isAdmin: user.isAdmin,
    isTutor: user.tutorId !== null,
    restriction: restriction && publicRestriction(restriction),
  };
}

// SAFE-1: every name word must match the first or last name. Every account is a Student, so the
// "student" filter means accounts without the Tutor capability.
export async function searchUsers(
  adminId: string,
  { q, role, page }: UserSearchQuery,
  now = new Date()
) {
  await requireAdmin(prisma, adminId);
  // Prisma contains uses LIKE patterns; typed percent and underscore characters are literal.
  const words =
    q
      ?.split(/\s+/)
      .filter(Boolean)
      .map((word) => word.replace(/[\\%_]/g, "\\$&")) ?? [];
  const where: Prisma.UserWhereInput = {
    AND: words.map((word) => ({
      OR: [
        { firstName: { contains: word, mode: "insensitive" } },
        { lastName: { contains: word, mode: "insensitive" } },
      ],
    })),
    ...(role === "tutor"
      ? { tutorId: { not: null } }
      : role === "student"
        ? { tutorId: null }
        : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        ...managedUserSelect,
        accountActionsReceived: {
          where: activeRestrictionWhere(now),
          orderBy: restrictionOrder,
          take: 1,
          select: restrictionSelect,
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    results: users.map((user) => managedUser(user, user.accountActionsReceived[0] ?? null)),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

async function loadManagedUser(userId: string, now: Date) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...managedUserSelect,
      accountActionsReceived: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          type: true,
          reason: true,
          createdAt: true,
          endsAt: true,
          admin: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!user) throw new UserManagementError(404, "User not found");

  const actions = user.accountActionsReceived;
  const current =
    actions.find((action) => action.type === "BAN") ??
    actions
      .filter((action) => action.endsAt && action.endsAt > now)
      .sort((left, right) => right.endsAt!.getTime() - left.endsAt!.getTime())[0] ??
    null;

  return {
    ...managedUser(user, current),
    // The recorded administration history, newest first.
    actions: actions.map((action) => ({
      id: action.id,
      type: action.type,
      reason: action.reason,
      createdAt: action.createdAt.toISOString(),
      endsAt: action.endsAt?.toISOString() ?? null,
      admin: `${action.admin.firstName} ${action.admin.lastName}`.trim(),
    })),
  };
}

export async function getManagedUser(adminId: string, userId: string, now = new Date()) {
  await requireAdmin(prisma, adminId);
  return loadManagedUser(userId, now);
}

export async function takeAccountAction(
  adminId: string,
  userId: string,
  { type, reason, days }: AccountActionRequest,
  now = new Date()
) {
  const { target, action } = await prisma.$transaction(async (tx) => {
    await requireAdmin(tx, adminId);
    // Lock the account so two Admins acting at once cannot both ban it.
    await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${userId}::uuid FOR UPDATE`;
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        isAdmin: true,
        tutor: { select: { id: true, status: true } },
      },
    });
    if (!target) throw new UserManagementError(404, "User not found");
    if (target.id === adminId) {
      throw new UserManagementError(403, "You can't suspend or ban your own account");
    }
    if (target.isAdmin) {
      throw new UserManagementError(403, "Administrator accounts can't be suspended or banned");
    }

    const active = await tx.accountAction.findFirst({
      where: { userId, ...activeRestrictionWhere(now) },
      orderBy: restrictionOrder,
      select: restrictionSelect,
    });
    if (active?.type === "BAN")
      throw new UserManagementError(409, "This account is already banned");
    if (type === "SUSPEND" && active?.endsAt) {
      throw new UserManagementError(
        409,
        `This account is already suspended until ${formatRestrictionEnd(active.endsAt)}`
      );
    }

    const action = await tx.accountAction.create({
      data: {
        userId,
        adminId,
        type,
        reason,
        endsAt: type === "SUSPEND" ? new Date(now.getTime() + days! * DAY_MS) : null,
      },
      select: restrictionSelect,
    });
    // A restricted Tutor leaves search and takes no new bookings; booked lessons stay.
    if (target.tutor?.status === "PUBLISHED") {
      await tx.tutor.update({ where: { id: target.tutor.id }, data: { status: "UNPUBLISHED" } });
    }
    return { target, action };
  });

  try {
    await sendAccountActionEmail({
      to: target.email,
      firstName: target.firstName,
      type: action.type,
      reason: action.reason,
      until: action.endsAt ? formatRestrictionEnd(action.endsAt) : null,
    });
  } catch (error) {
    // The restriction already stands; a failed notice must not undo it.
    console.error("Could not send the account action email", error);
  }

  return loadManagedUser(userId, now);
}
