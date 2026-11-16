import { tutorApi } from "@/src/lib/tutor-application";

// SAFE-1: an Admin's view of an account. A ban has no end; a suspension ends at endsAt.
export type AccountActionType = "SUSPEND" | "BAN";
export type AccountRestriction = { type: AccountActionType; reason: string; endsAt: string | null };

export type ManagedUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  isTutor: boolean;
  restriction: AccountRestriction | null;
};

export type AccountActionRecord = {
  id: string;
  type: AccountActionType;
  reason: string;
  createdAt: string;
  endsAt: string | null;
  admin: string;
};

export type ManagedUserDetail = ManagedUser & { actions: AccountActionRecord[] };

export type UserRoleFilter = "all" | "student" | "tutor";

export type UserSearchPage = {
  results: ManagedUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AccountActionInput =
  { type: "SUSPEND"; reason: string; days: 1 | 7 | 30 } | { type: "BAN"; reason: string };

export function searchUsers(
  { q, role, page }: { q: string; role: UserRoleFilter; page: number },
  signal?: AbortSignal
) {
  const query = new URLSearchParams({ role, page: String(page) });
  if (q.trim()) query.set("q", q.trim());
  return tutorApi<UserSearchPage>(`/api/admin/users?${query}`, { signal });
}

export function getManagedUser(userId: string, signal?: AbortSignal) {
  return tutorApi<ManagedUserDetail>(`/api/admin/users/${encodeURIComponent(userId)}`, { signal });
}

export function takeAccountAction(userId: string, input: AccountActionInput) {
  return tutorApi<ManagedUserDetail>(`/api/admin/users/${encodeURIComponent(userId)}/actions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

const bangkokTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

// Matches the time the user is told in the notice email.
export function formatAccountTime(iso: string) {
  return `${bangkokTime.format(new Date(iso))} (Bangkok time)`;
}

export function restrictionLabel({ type, endsAt }: AccountRestriction) {
  return type === "BAN" || !endsAt ? "Banned" : `Suspended until ${formatAccountTime(endsAt)}`;
}
