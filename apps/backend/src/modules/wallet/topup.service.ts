import {
  Prisma,
  type TopupRequest,
  type TopupRequestStatus,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { env } from "../../lib/env.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import { appendWalletMovement } from "./wallet-ledger.ts";
import { WalletDomainError } from "./wallet.service.ts";
import type { CreateTopupInput, TopupReviewInput } from "./wallet.schema.ts";

// PAY-1: a top-up is a request with a transfer slip. Nothing is credited until an admin
// checks the slip and approves it; approval appends one TOP_UP row with the request's id.

export function topupRequestResponse(request: TopupRequest) {
  return {
    id: request.id,
    amount: request.amount.toFixed(2),
    slipUrl: request.slipUrl,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    rejectionReason: request.rejectionReason,
  };
}

const RECENT_TOPUPS = 10;

// Banking apps can scan this QR and show its details, but cannot complete the transfer.
const PLACEHOLDER_PROMPTPAY_ID = "0000000000";

export async function listMyTopups(userId: string) {
  const requests = await prisma.topupRequest.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RECENT_TOPUPS,
  });
  return {
    requests: requests.map(topupRequestResponse),
    promptPayId: env.promptPayId || PLACEHOLDER_PROMPTPAY_ID,
  };
}

export async function createTopup(userId: string, input: CreateTopupInput) {
  try {
    const request = await prisma.topupRequest.create({
      data: { userId, amount: new Prisma.Decimal(input.amount), slipUrl: input.slipUrl },
    });
    return topupRequestResponse(request);
  } catch (error) {
    // The partial unique index allows one PENDING request per user.
    if ((error as { code?: string }).code === "P2002") {
      throw new WalletDomainError(
        "TOPUP_PENDING_EXISTS",
        "You already have a top-up waiting for review. Wait for an admin to review it.",
        409
      );
    }
    throw error;
  }
}

function notFound() {
  return new WalletDomainError("TOPUP_NOT_FOUND", "Top-up not found", 404);
}

function notPending() {
  return new WalletDomainError("TOPUP_NOT_PENDING", "This top-up is no longer pending", 409);
}

async function requireAdmin(client: Prisma.TransactionClient, adminId: string) {
  const user = await client.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
  if (!user?.isAdmin) {
    throw new WalletDomainError("ADMIN_REQUIRED", "Administrator access required", 403);
  }
}

export async function listTopupsForReview(adminId: string, status?: TopupRequestStatus) {
  await requireAdmin(prisma, adminId);
  const requests = await prisma.topupRequest.findMany({
    where: { status },
    // Pending requests are reviewed oldest first; history shows the newest first. With no
    // status filter, pending comes first because the enum declares it first.
    orderBy: !status
      ? [{ status: "asc" }, { createdAt: "desc" }]
      : status === "PENDING"
        ? [{ createdAt: "asc" }]
        : [{ createdAt: "desc" }],
    take: 100,
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return {
    requests: requests.map(({ user, ...request }) => ({
      ...topupRequestResponse(request),
      user,
    })),
  };
}

export async function reviewTopup(adminId: string, id: string, input: TopupReviewInput) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await requireAdmin(tx, adminId);
          const request = await tx.topupRequest.findUnique({ where: { id } });
          if (!request) throw notFound();
          if (request.userId === adminId) {
            throw new WalletDomainError(
              "TOPUP_SELF_REVIEW",
              "Another admin has to review your own top-up",
              403
            );
          }
          const reviewed = await tx.topupRequest.updateMany({
            where: { id, status: "PENDING" },
            data: {
              status: input.decision,
              reviewedAt: new Date(),
              reviewedById: adminId,
              rejectionReason: input.decision === "REJECTED" ? input.rejectionReason! : null,
            },
          });
          if (reviewed.count !== 1) throw notPending();
          if (input.decision === "APPROVED") {
            await appendWalletMovement(tx, {
              id: request.id,
              userId: request.userId,
              type: "TOP_UP",
              amount: request.amount,
            });
          }
          return topupRequestResponse(await tx.topupRequest.findUniqueOrThrow({ where: { id } }));
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (attempt < 2 && isTransactionConflict(error)) continue;
      throw error;
    }
  }
  throw new WalletDomainError("TOPUP_RETRY", "Please try again in a moment", 409);
}
