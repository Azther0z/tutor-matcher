"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PolicyDocument = "privacy" | "terms";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isTutor, setIsTutor] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [openDocument, setOpenDocument] = useState<PolicyDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!consentAccepted) {
      setError("Please accept the Privacy Policy and Terms of Service to continue.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, isTutor }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      if (isTutor) {
        const loginResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const loginData = (await loginResponse.json().catch(() => null)) as {
          token?: string;
          message?: string;
        } | null;

        if (!loginResponse.ok || !loginData?.token) {
          setError(
            loginData?.message ?? "Account created. Please log in to complete your profile."
          );
          return;
        }

        localStorage.setItem("authToken", loginData.token);
        router.push("/settings/tutor");
        return;
      }

      router.push("/login");
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
        <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Confirm password
          <input
            type="password"
            name="confirmPassword"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
          />
        </label>

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="isTutor"
            checked={isTutor}
            onChange={(e) => setIsTutor(e.target.checked)}
            className="h-4 w-4 rounded border-black/[.25] dark:border-white/[.3]"
          />
          Are you a tutor?
        </label>

        <label className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="consentAccepted"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-black/[.25] dark:border-white/[.3]"
            aria-invalid={!consentAccepted && !!error}
            aria-describedby="consent-description"
          />
          <span id="consent-description">
            I agree to the{" "}
            <button
              type="button"
              onClick={() => setOpenDocument("privacy")}
              className="underline"
              aria-haspopup="dialog"
            >
              Privacy Policy
            </button>{" "}
            and{" "}
            <button
              type="button"
              onClick={() => setOpenDocument("terms")}
              className="underline"
              aria-haspopup="dialog"
            >
              Terms of Service
            </button>
            .
          </span>
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
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>

      {openDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6 py-8"
          role="presentation"
          onClick={() => setOpenDocument(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-dialog-title"
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-black/[.12] bg-background p-6 text-left shadow-xl dark:border-white/[.18]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="policy-dialog-title" className="text-xl font-semibold tracking-tight">
                {openDocument === "privacy" ? "Privacy Policy" : "Terms of Service"}
              </h2>
              <button
                type="button"
                onClick={() => setOpenDocument(null)}
                className="rounded-full px-2 py-1 text-xl leading-none text-zinc-500 hover:bg-black/[.06] dark:hover:bg-white/[.1]"
                aria-label="Close document"
              >
                ×
              </button>
            </div>

            {openDocument === "privacy" ? (
              <div className="mt-5 space-y-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                <p>Last updated: September 4, 2026</p>
                <p>
                  Tutor Matcher collects the information you provide, such as your email address,
                  profile details, learning goals, and messages, to create and operate your account
                  and connect students with tutors.
                </p>
                <p>
                  We use this information to provide matching, communication, safety, and support
                  features. We do not sell your personal information. We may share information with
                  service providers who help us operate the platform or when required by law.
                </p>
                <p>
                  You are responsible for keeping your account details secure. You may contact the
                  Tutor Matcher team to request access, correction, or deletion of your information,
                  subject to applicable legal and operational requirements.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                <p>Last updated: September 4, 2026</p>
                <p>
                  By using Tutor Matcher, you agree to provide accurate information, keep your
                  account secure, and use the service lawfully and respectfully.
                </p>
                <p>
                  Tutor Matcher helps students and tutors discover and communicate with one another.
                  We do not guarantee a particular match, lesson outcome, availability, or service
                  quality, and users should exercise appropriate judgment when arranging lessons.
                </p>
                <p>
                  We may suspend or close accounts that misuse the platform, violate these terms, or
                  create a safety or security risk. These terms may be updated as the service
                  changes; continued use after an update means you accept the revised terms.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
