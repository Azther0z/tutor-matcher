"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountField, formClass, saveClass, type FieldErrors } from "./account-field";
import { getAuthToken } from "@/src/lib/auth";
import { updateAccount } from "@/src/lib/account-api";

const MIN_PASSWORD_LENGTH = 8;

export function PasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!password && !confirm) {
      setErrors({});
      setMessage("Enter a new password before saving.");
      return;
    }
    const nextErrors: FieldErrors = {};
    if (password.length < MIN_PASSWORD_LENGTH)
      nextErrors.newPassword = `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (confirm !== password) nextErrors.confirmPassword = "Passwords do not match.";
    if (!current) nextErrors.currentPassword = "Enter your current password to save changes.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Correct the highlighted fields before saving.");
      return;
    }
    const token = getAuthToken();
    if (!token) return router.replace("/login");
    setSubmitting(true);
    try {
      const result = await updateAccount(token, {
        newPassword: password,
        currentPassword: current,
      });
      if (!result.ok) {
        if (result.status === 403)
          setErrors({ currentPassword: result.data?.message ?? "Current password is incorrect." });
        setMessage(result.data?.message ?? "Could not save your password.");
        return;
      }
      setPassword("");
      setConfirm("");
      setCurrent("");
      setErrors({});
      setMessage("Password saved. Use it the next time you log in.");
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className={formClass} noValidate>
      <div>
        <h2 className="text-xl font-semibold">Password</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Leave both fields empty to keep your current password.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountField
          name="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={errors.newPassword}
          onChange={setPassword}
        />
        <AccountField
          name="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirmPassword}
          onChange={setConfirm}
        />
      </div>
      <AccountField
        name="password-currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={current}
        error={errors.currentPassword}
        onChange={setCurrent}
      />
      {message && (
        <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
          {message}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className={saveClass}>
          {submitting ? "Saving…" : "Save password"}
        </button>
      </div>
    </form>
  );
}
