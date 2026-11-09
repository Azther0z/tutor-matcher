import { getAuthToken } from "@/src/lib/auth";
import type { RefundRequestReason, RefundRequestStatus } from "@/src/types/booking";

// PAY-3: the admin queue for refund requests. A no-show is approved when filed, so it shows
// in history without a reviewing admin.
export type AdminRefundRequest = {
  id: string;
  reason: RefundRequestReason;
  details: string | null;
  status: RefundRequestStatus;
  amount: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  reviewedByAdmin: boolean;
  student: { id: string; firstName: string; lastName: string; email: string };
  booking: {
    id: string;
    status: string;
    subjectName: string;
    tutorName: string;
    startedAt: string;
    endedAt: string;
  };
};

export const refundReasonLabels: Record<RefundRequestReason, string> = {
  TUTOR_NO_SHOW: "Tutor didn't show up",
  UNSATISFACTORY_LESSON: "Unsatisfactory lesson or other problem",
};

export class RefundApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "RefundApiError";
  }
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
  } & T;
  if (!response.ok) {
    throw new RefundApiError(
      body.message || "Could not complete the refund request.",
      response.status,
      body.code
    );
  }
  return body;
}

// With no status, the backend returns every request, pending first.
export async function getRefundsForReview(status?: RefundRequestStatus) {
  const query = status ? `?${new URLSearchParams({ status })}` : "";
  return (await apiRequest<{ requests: AdminRefundRequest[] }>(`/api/admin/refunds${query}`))
    .requests;
}

export function reviewRefund(
  id: string,
  decision: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  return apiRequest<AdminRefundRequest>(`/api/admin/refunds/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, ...(rejectionReason ? { rejectionReason } : {}) }),
  });
}
