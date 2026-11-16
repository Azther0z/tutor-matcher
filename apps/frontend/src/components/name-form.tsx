"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountField, formClass, saveClass, type FieldErrors } from "./account-field";
import { getAuthToken } from "@/src/lib/auth";
import { updateAccount } from "@/src/lib/account-api";

export function NameForm({
  first: initialFirst,
  last: initialLast,
}: {
  first: string;
  last: string;
}) {
  const router = useRouter();
  const [savedFirst, setSavedFirst] = useState(initialFirst);
  const [savedLast, setSavedLast] = useState(initialLast);
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (first.trim() === savedFirst && last.trim() === savedLast) {
      setErrors({});
      setMessage("Change your name before saving.");
      return;
    }
    const nextErrors: FieldErrors = {};
    if (!first.trim()) nextErrors.firstName = "First name is required.";
    if (!last.trim()) nextErrors.lastName = "Last name is required.";
    if (!password) nextErrors.currentPassword = "Enter your current password to save changes.";
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
        firstName: first.trim(),
        lastName: last.trim(),
        currentPassword: password,
      });
      if (!result.ok) {
        if (result.status === 403)
          setErrors({ currentPassword: result.data?.message ?? "Current password is incorrect." });
        setMessage(result.data?.message ?? "Could not save your name.");
        return;
      }
      const nextFirst = result.data?.account?.firstName ?? first.trim();
      const nextLast = result.data?.account?.lastName ?? last.trim();
      setSavedFirst(nextFirst);
      setFirst(nextFirst);
      setSavedLast(nextLast);
      setLast(nextLast);
      setPassword("");
      setErrors({});
      setMessage("Name saved.");
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className={formClass} noValidate>
      <div>
        <h2 className="text-xl font-semibold">Name</h2>
        <p className="mt-1 text-sm text-zinc-500">How you&apos;re addressed on Tutor Matcher.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountField
          name="firstName"
          label="First name"
          type="text"
          autoComplete="given-name"
          value={first}
          error={errors.firstName}
          onChange={setFirst}
        />
        <AccountField
          name="lastName"
          label="Last name"
          type="text"
          autoComplete="family-name"
          value={last}
          error={errors.lastName}
          onChange={setLast}
        />
      </div>
      <AccountField
        name="name-currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={password}
        error={errors.currentPassword}
        onChange={setPassword}
      />
      {message && (
        <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
          {message}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className={saveClass}>
          {submitting ? "Saving…" : "Save name"}
        </button>
      </div>
    </form>
  );
}
