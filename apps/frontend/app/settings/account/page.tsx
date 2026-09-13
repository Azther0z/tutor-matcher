"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { getAuthToken, setAuthToken } from "@/src/lib/auth";

type FieldErrors = Partial<Record<string, string>>;

const inputClassName =
  "h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground aria-[invalid=true]:border-red-500 dark:border-white/[.18]";

const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type AccountUpdateResponse = {
  message?: string;
  token?: string;
  account?: { email?: string };
};

type AccountUpdateResult =
  | { ok: true; data: AccountUpdateResponse | null }
  | { ok: false; status: number; data: AccountUpdateResponse | null };

// Both the email form and the password form PUT the same endpoint and both
// need the reissued token stored the same way (the server always reissues
// it, since the token carries the account's current email regardless of
// which field changed). Centralizing this keeps a future contract change to
// a one-place edit instead of two.
async function submitAccountUpdate(
  token: string,
  body: Record<string, unknown>
): Promise<AccountUpdateResult> {
  const response = await fetch("/api/profiles/me/account", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as AccountUpdateResponse | null;

  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  if (data?.token) setAuthToken(data.token);

  return { ok: true, data };
}

type FieldProps = {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

// The error message is a sibling of the input rather than a child of the label,
// so a highlighted field keeps its label as its accessible name instead of
// growing the message into it.
function Field({ name, label, type, autoComplete, value, error, onChange }: FieldProps) {
  const errorId = `${name}-error`;

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={inputClassName}
      />
      {error && (
        <span id={errorId} className="font-normal text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}

// The settings section has only one destination today. This local nav mirrors
// the shape of Ideal's prototype without inventing a shared settings layout
// before a second real settings page exists to justify one.
function SettingsSidebar() {
  return (
    <nav
      aria-label="Settings"
      className="flex w-full flex-none flex-col gap-1 rounded-2xl border border-black/[.12] p-3 sm:w-56 dark:border-white/[.18]"
    >
      <Link
        href="/settings/account"
        aria-current="page"
        className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
      >
        Account
      </Link>
    </nav>
  );
}

export default function AccountSettingsPage() {
  return (
    <RequireAuth>
      <AccountSettingsForm />
    </RequireAuth>
  );
}

function AccountSettingsForm() {
  const router = useRouter();

  const [savedEmail, setSavedEmail] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<FieldErrors>({});
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const controller = new AbortController();

    fetch("/api/profiles/me/account", {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the account");

        const data = (await response.json()) as { email?: string };
        setSavedEmail(data.email ?? "");
        setEmail(data.email ?? "");
      })
      .catch((error: unknown) => {
        if ((error as DOMException)?.name === "AbortError") return;
        setLoadError("We could not load your account settings. Please refresh and try again.");
      });

    return () => controller.abort();
  }, []);

  const emailChanged = email.trim() !== savedEmail;
  const passwordChanged = newPassword.length > 0 || confirmPassword.length > 0;

  function validateEmailForm() {
    const errors: FieldErrors = {};

    if (!email.trim()) errors.email = "Email is required.";
    else if (!isValidEmail(email.trim())) errors.email = "Enter a valid email address.";

    if (!emailCurrentPassword) {
      errors.currentPassword = "Enter your current password to save changes.";
    }

    setEmailErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validatePasswordForm() {
    const errors: FieldErrors = {};

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (confirmPassword !== newPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (!passwordCurrentPassword) {
      errors.currentPassword = "Enter your current password to save changes.";
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailMessage(null);

    if (!emailChanged) {
      setEmailErrors({});
      setEmailMessage("Change your email address before saving.");
      return;
    }

    if (!validateEmailForm()) {
      setEmailMessage("Correct the highlighted fields before saving.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setEmailSubmitting(true);

    try {
      const result = await submitAccountUpdate(token, {
        email: email.trim(),
        currentPassword: emailCurrentPassword,
      });

      if (!result.ok) {
        // The server owns the reasons the client cannot check: whether the
        // current password matched, and whether the email is already taken.
        if (result.status === 403) {
          setEmailErrors({
            currentPassword: result.data?.message ?? "Current password is incorrect.",
          });
        } else if (result.status === 409) {
          setEmailErrors({
            email: result.data?.message ?? "That email address is already in use.",
          });
        }

        setEmailMessage(result.data?.message ?? "Could not save your email address.");
        return;
      }

      setSavedEmail(result.data?.account?.email ?? email.trim());
      setEmail(result.data?.account?.email ?? email.trim());
      setEmailCurrentPassword("");
      setEmailErrors({});
      setEmailMessage("Email address saved.");
    } catch {
      setEmailMessage("Could not reach the server. Please try again.");
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);

    if (!passwordChanged) {
      setPasswordErrors({});
      setPasswordMessage("Enter a new password before saving.");
      return;
    }

    if (!validatePasswordForm()) {
      setPasswordMessage("Correct the highlighted fields before saving.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setPasswordSubmitting(true);

    try {
      const result = await submitAccountUpdate(token, {
        newPassword,
        currentPassword: passwordCurrentPassword,
      });

      if (!result.ok) {
        if (result.status === 403) {
          setPasswordErrors({
            currentPassword: result.data?.message ?? "Current password is incorrect.",
          });
        }

        setPasswordMessage(result.data?.message ?? "Could not save your password.");
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordCurrentPassword("");
      setPasswordErrors({});
      setPasswordMessage("Password saved. Use it the next time you log in.");
    } catch {
      setPasswordMessage("Could not reach the server. Please try again.");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16 sm:flex-row">
      <SettingsSidebar />

      <div className="flex flex-1 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Tutor Matcher
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Account settings</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Update the email address and password you sign in with.
          </p>
        </div>

        {loadError && (
          <p role="status" className="text-sm text-red-600 dark:text-red-400">
            {loadError}
          </p>
        )}

        <form
          onSubmit={handleEmailSubmit}
          className="flex flex-col gap-5 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]"
          noValidate
        >
          <div>
            <h2 className="text-xl font-semibold">Email address</h2>
            <p className="mt-1 text-sm text-zinc-500">Used to sign in and to reach you.</p>
          </div>

          <Field
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            error={emailErrors.email}
            onChange={setEmail}
          />

          <Field
            name="email-currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={emailCurrentPassword}
            error={emailErrors.currentPassword}
            onChange={setEmailCurrentPassword}
          />

          {emailMessage && (
            <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
              {emailMessage}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={emailSubmitting}
              className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
            >
              {emailSubmitting ? "Saving…" : "Save email"}
            </button>
          </div>
        </form>

        <form
          onSubmit={handlePasswordSubmit}
          className="flex flex-col gap-5 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]"
          noValidate
        >
          <div>
            <h2 className="text-xl font-semibold">Password</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Leave both fields empty to keep your current password.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              error={passwordErrors.newPassword}
              onChange={setNewPassword}
            />
            <Field
              name="confirmPassword"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              error={passwordErrors.confirmPassword}
              onChange={setConfirmPassword}
            />
          </div>

          <Field
            name="password-currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={passwordCurrentPassword}
            error={passwordErrors.currentPassword}
            onChange={setPasswordCurrentPassword}
          />

          {passwordMessage && (
            <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
              {passwordMessage}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordSubmitting}
              className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
            >
              {passwordSubmitting ? "Saving…" : "Save password"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
