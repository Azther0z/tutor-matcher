"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { TutorDialog } from "@/src/components/tutor-dialog";
import {
  formatAccountTime,
  getManagedUser,
  restrictionLabel,
  searchUsers,
  takeAccountAction,
  type AccountActionType,
  type ManagedUser,
  type ManagedUserDetail,
  type UserRoleFilter,
  type UserSearchPage,
} from "@/src/lib/admin-users-api";
import { TutorApiError } from "@/src/lib/tutor-application";

const shell = "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-16";
const button =
  "inline-flex items-center justify-center rounded-full border border-black/[.12] px-5 py-2.5 font-medium disabled:opacity-60 dark:border-white/[.18]";
const dangerButton =
  "inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 font-medium text-white disabled:opacity-60";
const badge = "inline-flex rounded-md px-2 py-1 text-xs font-medium";
const badgeColors = {
  role: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  admin: "bg-violet-500/10 text-violet-800 dark:text-violet-300",
  SUSPEND: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  BAN: "bg-rose-500/10 text-rose-800 dark:text-rose-300",
};
const roleFilters: { value: UserRoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "student", label: "Student" },
  { value: "tutor", label: "Tutor" },
];
const suspensionDays = [1, 7, 30] as const;

type Search = { q: string; role: UserRoleFilter; page: number };

export default function AdminUsersPage() {
  return (
    <RequireAuth>
      <UserManagement />
    </RequireAuth>
  );
}

function UserManagement() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState<Search>({ q: "", role: "all", page: 1 });
  const [results, setResults] = useState<UserSearchPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    searchUsers(search, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setResults(page);
        setError(null);
        setLoading(false);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setResults(null);
        setError(failure instanceof Error ? failure.message : "Could not load users.");
        setForbidden(failure instanceof TutorApiError && failure.status === 403);
        setLoading(false);
      });
    return () => controller.abort();
  }, [search]);

  function changeSearch(next: Partial<Search>) {
    setSearch((current) => ({ ...current, ...next }));
    setLoading(true);
  }

  // A suspension or ban shows on the result row straight away.
  const updateRow = useCallback((updated: ManagedUserDetail) => {
    setResults(
      (current) =>
        current && {
          ...current,
          results: current.results.map((user) =>
            user.id === updated.id ? { ...user, restriction: updated.restriction } : user
          ),
        }
    );
  }, []);

  return (
    <main className={shell}>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Users</h1>
        <p className="mt-3 text-zinc-500">
          Search accounts by name, then message, suspend or ban the selected user. A suspension
          lifts automatically when it ends; a ban is permanent.
        </p>
      </div>
      {forbidden ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          Admin access required. You do not have permission to manage users.
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section
            aria-label="User search"
            className="overflow-hidden rounded-lg border border-black/[.12] dark:border-white/[.18]"
          >
            <div className="flex flex-col gap-3 border-b border-black/[.12] p-4 dark:border-white/[.18]">
              <form
                role="search"
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  changeSearch({ q: draft, page: 1 });
                }}
              >
                <input
                  type="search"
                  aria-label="Search by name"
                  placeholder="Search by name"
                  maxLength={100}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-full border border-black/[.12] bg-transparent px-4 outline-none focus:border-foreground dark:border-white/[.18]"
                />
                <button type="submit" className={button}>
                  Search
                </button>
              </form>
              <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-2">
                {roleFilters.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={search.role === value}
                    onClick={() => changeSearch({ role: value, page: 1 })}
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                      search.role === value
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-black/15 hover:border-violet-500 dark:border-white/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <div role="alert" className="px-4 py-5 text-sm text-red-600 dark:text-red-400">
                <p>{error}</p>
                <button
                  type="button"
                  className="mt-2 font-medium underline"
                  disabled={loading}
                  onClick={() => changeSearch({})}
                >
                  Retry user search
                </button>
              </div>
            )}
            {loading && !results && (
              <p className="px-4 py-5 text-sm text-zinc-500">Loading users…</p>
            )}
            {results && (
              <div aria-busy={loading}>
                <p aria-live="polite" className="px-4 pt-3 text-sm text-zinc-500">
                  {results.total === 1 ? "1 user" : `${results.total} users`}
                </p>
                {results.results.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-zinc-500">No users match this search.</p>
                ) : (
                  <ul className="divide-y divide-black/[.12] dark:divide-white/[.18]">
                    {results.results.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          aria-current={selectedId === user.id ? "true" : undefined}
                          onClick={() => setSelectedId(user.id)}
                          className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.05] ${
                            selectedId === user.id ? "bg-black/[.05] dark:bg-white/[.08]" : ""
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">
                              {user.firstName} {user.lastName}
                            </span>
                            <span className="block break-all text-sm text-zinc-500">
                              {user.email}
                            </span>
                          </span>
                          <UserBadges user={user} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {results.totalPages > 1 && (
                  <nav
                    aria-label="Result pages"
                    className="flex items-center justify-between gap-3 border-t border-black/[.12] px-4 py-3 text-sm dark:border-white/[.18]"
                  >
                    <button
                      type="button"
                      className={button}
                      disabled={loading || search.page <= 1}
                      onClick={() => changeSearch({ page: search.page - 1 })}
                    >
                      Previous
                    </button>
                    <span>
                      Page {results.page} of {results.totalPages}
                    </span>
                    <button
                      type="button"
                      className={button}
                      disabled={loading || search.page >= results.totalPages}
                      onClick={() => changeSearch({ page: search.page + 1 })}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </div>
            )}
          </section>
          {selectedId ? (
            <ManagedUserPanel key={selectedId} userId={selectedId} onUpdated={updateRow} />
          ) : (
            <p className="rounded-lg border border-dashed border-black/[.12] p-6 text-sm text-zinc-500 dark:border-white/[.18]">
              Select a user to message, suspend or ban them.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function UserBadges({ user }: { user: ManagedUser }) {
  return (
    <span className="flex flex-wrap gap-2">
      <span className={`${badge} ${badgeColors.role}`}>{user.isTutor ? "Tutor" : "Student"}</span>
      {user.isAdmin && <span className={`${badge} ${badgeColors.admin}`}>Admin</span>}
      {user.restriction && (
        <span className={`${badge} ${badgeColors[user.restriction.type]}`}>
          {user.restriction.type === "BAN" ? "Banned" : "Suspended"}
        </span>
      )}
    </span>
  );
}

function ManagedUserPanel({
  userId,
  onUpdated,
}: {
  userId: string;
  onUpdated: (user: ManagedUserDetail) => void;
}) {
  const [detail, setDetail] = useState<ManagedUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<AccountActionType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Moves focus to the selected account, which also scrolls it into view on small screens.
  const focusHeading = useCallback((node: HTMLHeadingElement | null) => node?.focus(), []);

  useEffect(() => {
    const controller = new AbortController();
    getManagedUser(userId, controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) {
          setDetail(loaded);
          setError(null);
        }
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : "Could not load this account.");
      });
    return () => controller.abort();
  }, [userId, attempt]);

  const panel =
    "flex flex-col gap-5 rounded-lg border border-black/[.12] p-5 dark:border-white/[.18]";
  if (error) {
    return (
      <section aria-label="Selected user" className={panel}>
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
        <button
          type="button"
          className={button}
          onClick={() => {
            setError(null);
            setAttempt((current) => current + 1);
          }}
        >
          Retry account
        </button>
      </section>
    );
  }
  if (!detail) {
    return (
      <section aria-label="Selected user" className={panel}>
        <p className="text-sm text-zinc-500">Loading account…</p>
      </section>
    );
  }

  const name = `${detail.firstName} ${detail.lastName}`;
  const openAction = (type: AccountActionType) => {
    setMessage(null);
    setAction(type);
  };

  return (
    <section aria-labelledby="managed-user-name" className={panel}>
      <div className="flex flex-col gap-2">
        <h2
          id="managed-user-name"
          ref={focusHeading}
          tabIndex={-1}
          className="text-2xl font-semibold focus:outline-none"
        >
          {name}
        </h2>
        <p className="break-all text-sm text-zinc-500">{detail.email}</p>
        <UserBadges user={detail} />
      </div>
      <div className="rounded-lg bg-black/[.03] p-4 text-sm dark:bg-white/[.05]">
        {detail.restriction ? (
          <>
            <p className="font-medium">{restrictionLabel(detail.restriction)}</p>
            <p className="mt-1">Reason: {detail.restriction.reason}</p>
          </>
        ) : (
          <p>Active: this account has full access.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/messages?with=${detail.id}&name=${encodeURIComponent(name)}`}
          className={button}
        >
          Message
        </Link>
        <button
          type="button"
          className={button}
          disabled={detail.isAdmin}
          onClick={() => openAction("SUSPEND")}
        >
          Suspend
        </button>
        <button
          type="button"
          className={dangerButton}
          disabled={detail.isAdmin}
          onClick={() => openAction("BAN")}
        >
          Ban
        </button>
      </div>
      {detail.isAdmin && (
        <p className="text-sm text-zinc-500">
          Administrator accounts can&apos;t be suspended or banned.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <section aria-labelledby="account-history-title">
        <h3 id="account-history-title" className="font-semibold">
          Administration history
        </h3>
        {detail.actions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No suspensions or bans recorded.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {detail.actions.map((record) => (
              <li
                key={record.id}
                className="rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.12]"
              >
                <p className="font-medium">{restrictionLabel(record)}</p>
                <p className="mt-1">Reason: {record.reason}</p>
                <p className="mt-1 text-zinc-500">
                  By {record.admin} on{" "}
                  <time dateTime={record.createdAt}>{formatAccountTime(record.createdAt)}</time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      {action && (
        <AccountActionDialog
          user={detail}
          type={action}
          onClose={() => setAction(null)}
          onDone={(updated) => {
            const restriction = updated.restriction;
            setDetail(updated);
            setAction(null);
            setMessage(
              restriction?.type === "SUSPEND" && restriction.endsAt
                ? `${name} is suspended until ${formatAccountTime(restriction.endsAt)}.`
                : `${name} is banned.`
            );
            onUpdated(updated);
          }}
        />
      )}
    </section>
  );
}

function AccountActionDialog({
  user,
  type,
  onClose,
  onDone,
}: {
  user: ManagedUserDetail;
  type: AccountActionType;
  onClose: () => void;
  onDone: (updated: ManagedUserDetail) => void;
}) {
  const [days, setDays] = useState<(typeof suspensionDays)[number]>(1);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const name = `${user.firstName} ${user.lastName}`;
  const verb = type === "BAN" ? "Ban" : "Suspend";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const trimmed = reason.trim();
    setError(null);
    setReasonMissing(!trimmed);
    if (!trimmed) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      onDone(
        await takeAccountAction(
          user.id,
          type === "BAN" ? { type, reason: trimmed } : { type, reason: trimmed, days }
        )
      );
    } catch (failure) {
      submittingRef.current = false;
      setError(
        failure instanceof Error ? failure.message : `Could not ${verb.toLowerCase()} this account.`
      );
      setBusy(false);
    }
  }

  return (
    <TutorDialog
      title={`${verb} ${name}`}
      titleId="account-action-title"
      onClose={onClose}
      busy={busy}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={button} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="account-action-form" className={dangerButton} disabled={busy}>
            {busy ? "Saving…" : `${verb} account`}
          </button>
        </div>
      }
    >
      <form id="account-action-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p>
          {type === "BAN"
            ? `${name} will lose access to Tutor Matcher permanently.`
            : `${name} will lose access to Tutor Matcher until the suspension ends.`}{" "}
          {user.isTutor && "Their tutor listing will be unpublished; lessons already booked stay. "}
          The reason is emailed to them and kept in the account&apos;s history.
        </p>
        {type === "SUSPEND" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Suspension length</legend>
            <div className="flex flex-wrap gap-4">
              {suspensionDays.map((option) => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="suspension-days"
                    checked={days === option}
                    onChange={() => setDays(option)}
                  />
                  {option === 1 ? "1 day" : `${option} days`}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Reason
          <textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={reasonMissing}
            className="rounded-lg border border-black/[.12] bg-transparent p-3 text-base font-normal dark:border-white/[.18]"
          />
        </label>
        {reasonMissing && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Enter a reason.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </TutorDialog>
  );
}
