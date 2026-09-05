import { RequireAuth } from "@/src/components/require-auth";
import { RoutePlaceholder } from "@/src/components/route-placeholder";
("use client");

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type StudentProfileStatus = "loading" | "incomplete" | "complete" | "error";

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StudentProfileStatus>("loading");

  useEffect(() => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      router.push("/login");
      return;
    }

    fetch("/api/profiles/me/student", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (response.status === 401) {
          localStorage.removeItem("authToken");
          router.push("/login");
          return;
        }

        if (response.status === 404) {
          setStatus("incomplete");
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load the Student profile");
        }

        setStatus("complete");
      })
      .catch(() => setStatus("error"));
  }, [router]);

  return (
    <RequireAuth>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Tutor Matcher
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Student dashboard</h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Find Tutors and manage your learning journey.
          </p>
        </div>

        {status === "loading" && <p className="text-zinc-500">Loading your dashboard…</p>}

        {status === "error" && (
          <p role="alert" className="text-red-600 dark:text-red-400">
            We could not load your profile. Please refresh and try again.
          </p>
        )}

        {status === "incomplete" && (
          <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold">Complete your Student profile</h2>
              <p className="leading-7 text-zinc-600 dark:text-zinc-400">
                Tell us what you want to learn so we can help you find Tutors that fit your goals.
              </p>
            </div>
            <Link
              href="/onboarding/student"
              className="flex h-11 w-fit items-center justify-center rounded-full bg-foreground px-5 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Continue onboarding
            </Link>
          </section>
        )}

        {status === "complete" && (
          <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
            <h2 className="text-2xl font-semibold">Your Student profile is ready</h2>
            <p className="mt-2 leading-7 text-zinc-600 dark:text-zinc-400">
              You can now explore Tutors matched to your learning preferences.
            </p>
          </section>
        )}
      </main>
    </RequireAuth>
  );
}
