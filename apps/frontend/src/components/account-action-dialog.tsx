import { useRef, useState } from "react";
import { TutorDialog } from "@/src/components/tutor-dialog";
import {
  takeAccountAction,
  type AccountActionType,
  type ManagedUserDetail,
} from "@/src/lib/admin-users-api";
import { button, dangerButton } from "@/src/lib/admin-users-style";

const suspensionDays = [1, 7, 30] as const;

// SAFE-1: the admin gives a reason (and a length for a suspension) before restricting an account.
export function AccountActionDialog({
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
            className="rounded-lg border border-line bg-transparent p-3 text-base font-normal"
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
