"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type PageState = "checking" | "invalid" | "ready" | "success";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [pageState, setPageState] = useState<PageState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validateToken() {
      if (!token) {
        setPageState("invalid");
        return;
      }

      try {
        const res = await fetch(
          `/api/auth/password-reset/validate?token=${encodeURIComponent(token)}`
        );
        if (cancelled) return;

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          setError(data?.message ?? "This password reset link is invalid or has expired.");
          setPageState("invalid");
          return;
        }

        setPageState("ready");
      } catch {
        if (!cancelled) {
          setError("Could not reach the server. Please try again.");
          setPageState("invalid");
        }
      }
    }

    void validateToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8 || password.length > 100) {
      setError("Password must be between 8 and 100 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        setError(data?.message ?? "This password reset link is invalid or has expired.");
        setPageState("invalid");
        return;
      }

      setPageState("success");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
      </div>

      {pageState === "checking" && (
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">Checking reset link…</p>
      )}

      {pageState === "invalid" && (
        <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 text-center dark:border-white/[.18]">
          <p role="alert" className="text-sm leading-6 text-red-600 dark:text-red-400">
            {error ?? "This password reset link is invalid or has expired."}
          </p>
          <Link href="/forgot-password" className="font-medium text-foreground underline">
            Request a new reset link
          </Link>
        </section>
      )}

      {pageState === "success" && (
        <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 text-center dark:border-white/[.18]">
          <h2 className="text-xl font-semibold">Password reset</h2>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Your password has been reset successfully.
          </p>
          <Link href="/login" className="font-medium text-foreground underline">
            Return to log in
          </Link>
        </section>
      )}

      {pageState === "ready" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            New password
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Confirm new password
            <input
              type="password"
              name="confirmPassword"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {submitting ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
    </main>
  );
}
