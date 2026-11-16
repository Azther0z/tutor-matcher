import { setAuthToken } from "@/src/lib/auth";

export type AccountRecord = { email?: string; firstName?: string; lastName?: string };
export type AccountResponse = { message?: string; token?: string; account?: AccountRecord };
export type AccountResult =
  | { ok: true; data: AccountResponse | null }
  | { ok: false; status: number; data: AccountResponse | null };

export async function loadAccount(token: string, signal: AbortSignal) {
  const response = await fetch("/api/profiles/me/account", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw new Error("Could not load the account");
  return (await response.json()) as AccountRecord;
}

export async function updateAccount(
  token: string,
  body: Record<string, unknown>
): Promise<AccountResult> {
  const response = await fetch("/api/profiles/me/account", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as AccountResponse | null;
  if (!response.ok) return { ok: false, status: response.status, data };
  if (data?.token) setAuthToken(data.token);
  return { ok: true, data };
}
