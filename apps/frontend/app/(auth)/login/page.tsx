"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { setAuthToken } from "@/src/lib/auth";

function explicitNextPath(next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

// An approved Tutor lands on their own dashboard by default; everyone else
// lands on the student dashboard. An explicit `?next=` (set when a guard
// redirected here) always takes priority over this.
async function resolveDefaultLandingPath(token: string) {
  try {
    const response = await fetch("/api/profiles/me/tutor", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = (await response.json()) as { status: string };
      if (data.status === "APPROVED") {
        return "/dashboard/tutor";
      }
    }
  } catch {
    // Network hiccup right after login — fall back to the student dashboard
    // rather than blocking navigation.
  }

  return "/dashboard";
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => null)) as {
        token?: string;
        message?: string;
      } | null;

      if (!res.ok) {
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      if (data?.token) {
        setAuthToken(data.token);
      }

      const next = explicitNextPath(searchParams.get("next"));
      const landingPath =
        next ?? (data?.token ? await resolveDefaultLandingPath(data.token) : "/dashboard");

      router.push(landingPath);
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
        <h1 className="text-3xl font-semibold tracking-tight">Log in</h1>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-white/[.18]"
          />
        </label>

        <div className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-foreground underline">
            Forgot password?
          </Link>
        </div>

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
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
