"use client";

import Link from "next/link";
import { useState } from "react";

const genericMessage = "If an account exists for that email, we sent a password reset link.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16"
    >
      <div className="flex flex-col gap-2 text-center">
        <p className="text-sm font-medium text-muted">Tutor Matcher</p>
        <h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="text-sm leading-6 text-secondary">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>

      {success ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 text-center">
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-sm leading-6 text-secondary">{genericMessage}</p>
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="text-sm font-medium text-foreground underline"
          >
            Request another link
          </button>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-lg border border-line bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-brand-link focus:border-foreground"
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
            className="flex h-12 w-full items-center justify-center rounded-lg bg-brand-navy px-5 text-base font-medium text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-secondary">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
