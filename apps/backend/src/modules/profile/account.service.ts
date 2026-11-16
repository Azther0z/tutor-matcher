import { prisma } from "../../lib/db.ts";
import type { AccountUpdateRequest } from "./profile.schema.ts";
import {
  AccountNotFoundError,
  EmailInUseError,
  InvalidCurrentPasswordError,
} from "./profile.errors.ts";

const accountSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  createdAt: true,
} as const;

async function authenticateAccount(userId: string, currentPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...accountSelect, password: true },
  });

  if (!user) throw new AccountNotFoundError();

  // Passwords remain plaintext until auth.service migrates both credential flows together.
  if (user.password !== currentPassword) throw new InvalidCurrentPasswordError();
  return user;
}

export async function getAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: accountSelect });
  if (!user) throw new AccountNotFoundError();
  return user;
}

export async function updateAccount(userId: string, input: AccountUpdateRequest) {
  const user = await authenticateAccount(userId, input.currentPassword);
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const email = input.email?.trim();

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== userId) throw new EmailInUseError();
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        email: email ?? undefined,
        password: input.newPassword ?? undefined,
      },
      select: accountSelect,
    });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "P2002") {
      throw new EmailInUseError();
    }
    throw error;
  }
}
