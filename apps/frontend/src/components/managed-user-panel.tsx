import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AccountActionDialog } from "@/src/components/account-action-dialog";
import { UserBadges } from "@/src/components/user-badges";
import {
  formatAccountTime,
  getManagedUser,
  restrictionLabel,
  type AccountActionType,
  type ManagedUserDetail,
} from "@/src/lib/admin-users-api";
import { button, dangerButton } from "@/src/lib/admin-users-style";

const panel = "flex flex-col gap-5 rounded-lg border border-line p-5";

// The selected account: its status, message and restriction actions, and its history.
export function ManagedUserPanel({
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
        <p className="text-sm text-muted">Loading account…</p>
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
          className="text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-brand-link"
        >
          {name}
        </h2>
        <p className="break-all text-sm text-muted">{detail.email}</p>
        <UserBadges user={detail} />
      </div>
      <div className="rounded-lg bg-surface-muted p-4 text-sm">
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
        <p className="text-sm text-muted">
          Administrator accounts can&apos;t be suspended or banned.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <section aria-labelledby="account-history-title">
        <h3 id="account-history-title" className="font-semibold">
          Administration history
        </h3>
        {detail.actions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No suspensions or bans recorded.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {detail.actions.map((record) => (
              <li key={record.id} className="rounded-lg border border-line p-3 text-sm">
                <p className="font-medium">{restrictionLabel(record)}</p>
                <p className="mt-1">Reason: {record.reason}</p>
                <p className="mt-1 text-muted">
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
