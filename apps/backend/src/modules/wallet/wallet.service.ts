import { prisma } from "../../lib/db.ts";

export class WalletDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export async function getWallet(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
  if (!user) throw new WalletDomainError("WALLET_NOT_FOUND", "Wallet not found", 404);
  return { balance: user.balance.toFixed(2) };
}
