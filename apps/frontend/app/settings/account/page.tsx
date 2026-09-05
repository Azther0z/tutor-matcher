"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/src/lib/auth";

type FieldName = "email" | "newPassword" | "confirmPassword" | "currentPassword";
type FieldErrors = Partial<Record<FieldName, string>>;

const inputClassName =
  "h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground aria-[invalid=true]:border-red-500 dark:border-white/[.18]";

const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type FieldProps = {
  name: FieldName;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

// The error message is a sibling of the input rather than a child of the label,
// so a highlighted field keeps "Email" as its accessible name instead of
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
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

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
        setMessage("We could not load your account settings. Please refresh and try again.");
      });

    return () => controller.abort();
  }, []);

  const emailChanged = email.trim() !== savedEmail;
  const passwordChanged = newPassword.length > 0 || confirmPassword.length > 0;

  function validate() {
    const errors: FieldErrors = {};

    if (!email.trim()) errors.email = "Email is required.";
    else if (!isValidEmail(email.trim())) errors.email = "Enter a valid email address.";

    if (passwordChanged) {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        errors.newPassword = `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
      }
      if (confirmPassword !== newPassword) {
        errors.confirmPassword = "Passwords do not match.";
      }
    }

    if (!currentPassword) {
      errors.currentPassword = "Enter your current password to save changes.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!emailChanged && !passwordChanged) {
      setFieldErrors({});
      setMessage("Change your email address or your password before saving.");
      return;
    }

    if (!validate()) {
      setMessage("Correct the highlighted fields before saving.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/profiles/me/account", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(emailChanged ? { email: email.trim() } : {}),
          ...(passwordChanged ? { newPassword } : {}),
          currentPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        message?: string;
        token?: string;
        account?: { email?: string };
      } | null;

      if (!response.ok) {
        // The server owns the reasons the client cannot check: whether the
        // current password matched, and whether the email is already taken.
        if (response.status === 403) {
          setFieldErrors({ currentPassword: data?.message ?? "Current password is incorrect." });
        } else if (response.status === 409) {
          setFieldErrors({ email: data?.message ?? "That email address is already in use." });
        }

        setMessage(data?.message ?? "Could not save your account settings.");
        return;
      }

      // The reissued token carries the new email, so the session stays valid.
      if (data?.token) setAuthToken(data.token);

      setSavedEmail(data?.account?.email ?? email.trim());
      setEmail(data?.account?.email ?? email.trim());
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setFieldErrors({});
      setMessage(
        passwordChanged
          ? "Account settings saved. Use your new password the next time you log in."
          : "Account settings saved."
      );
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    setMessage(null);

    if (!currentPassword) {
      setFieldErrors({ currentPassword: "Enter your current password to deactivate." });
      setMessage("Enter your current password to deactivate your account.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setDeactivating(true);

    try {
      const response = await fetch("/api/profiles/me/account/deactivate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        if (response.status === 403) {
          setFieldErrors({ currentPassword: data?.message ?? "Current password is incorrect." });
        }

        setMessage(data?.message ?? "Could not deactivate your account.");
        return;
      }

      // The account can no longer log in, so end the session here as well.
      clearAuthToken();
      router.replace("/login");
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-4xl font-semibold tracking-tight">Account settings</h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Update the email address and password you sign in with, or deactivate your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
        <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Email address</h2>
            <p className="mt-1 text-sm text-zinc-500">Used to sign in and to reach you.</p>
          </div>

          <Field
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            error={fieldErrors.email}
            onChange={setEmail}
          />
        </section>

        <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div className="mb-5">
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
              error={fieldErrors.newPassword}
              onChange={setNewPassword}
            />
            <Field
              name="confirmPassword"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={setConfirmPassword}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Confirm it is you</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Your current password is required to change these settings or to deactivate.
            </p>
          </div>

          <Field
            name="currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            error={fieldErrors.currentPassword}
            onChange={setCurrentPassword}
          />
        </section>

        {message && (
          <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
            {message}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-4 rounded-2xl border border-red-600/40 p-6">
        <div>
          <h2 className="text-xl font-semibold">Deactivate account</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Deactivating signs you out and blocks future logins. Your bookings and messages are
            kept. Contact support to reactivate.
          </p>
        </div>

        {confirmingDeactivation ? (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              This will end your session immediately. Are you sure?
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmingDeactivation(false)}
                className="flex h-11 items-center justify-center rounded-full border border-black/[.12] px-5 text-base font-medium hover:bg-black/[.04] dark:border-white/[.18] dark:hover:bg-white/[.08]"
              >
                Keep my account
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="flex h-11 items-center justify-center rounded-full bg-red-600 px-5 text-base font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {deactivating ? "Deactivating…" : "Yes, deactivate my account"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDeactivation(true)}
            className="flex h-11 w-fit items-center justify-center rounded-full border border-red-600/60 px-5 text-base font-medium text-red-600 transition-colors hover:bg-red-600/10"
          >
            Deactivate account
          </button>
        )}
      </section>
    </main>
  );
}
