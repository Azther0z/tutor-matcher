"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountField, formClass, saveClass, type FieldErrors } from "./account-field";
import { getAuthToken } from "@/src/lib/auth";
import { updateAccount } from "@/src/lib/account-api";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function EmailForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (email.trim() === savedEmail) {
      setErrors({});
      setMessage("Change your email address before saving.");
      return;
    }
    const nextErrors: FieldErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!validEmail(email.trim())) nextErrors.email = "Enter a valid email address.";
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
      const result = await updateAccount(token, { email: email.trim(), currentPassword: password });
      if (!result.ok) {
        if (result.status === 403)
          setErrors({ currentPassword: result.data?.message ?? "Current password is incorrect." });
        else if (result.status === 409)
          setErrors({ email: result.data?.message ?? "That email address is already in use." });
        setMessage(result.data?.message ?? "Could not save your email address.");
        return;
      }
      const saved = result.data?.account?.email ?? email.trim();
      setSavedEmail(saved);
      setEmail(saved);
      setPassword("");
      setErrors({});
      setMessage("Email address saved.");
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className={formClass} noValidate>
      <div>
        <h2 className="text-xl font-semibold">Email address</h2>
        <p className="mt-1 text-sm text-zinc-500">Used to sign in and to reach you.</p>
      </div>
      <AccountField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={errors.email}
        onChange={setEmail}
      />
      <AccountField
        name="email-currentPassword"
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
          {submitting ? "Saving…" : "Save email"}
        </button>
      </div>
    </form>
  );
}
