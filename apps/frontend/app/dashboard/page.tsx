"use client";

import { RequireAuth } from "@/src/components/require-auth";
import { TutorAvailabilityEditor } from "@/src/components/tutor-availability-editor";
import { TutorNeedsConfirmation } from "@/src/components/tutor-needs-confirmation";
import { TutorUpcomingClasses } from "@/src/components/tutor-upcoming-classes";
import { TutorDashboardStats } from "@/src/components/tutor-dashboard-stats";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { getBookings } from "@/src/lib/bookings-api";
import type { Booking } from "@/src/types/booking";

type StudentProfileStatus = "loading" | "incomplete" | "complete" | "error";
type DashboardTab = "student" | "tutor";

const dashboardTabs: DashboardTab[] = ["student", "tutor"];
const studentDateFormat = new Intl.DateTimeFormat("en", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<StudentProfileStatus>("loading");
  const [nextLesson, setNextLesson] = useState<Booking | null>(null);
  const [nextLessonStatus, setNextLessonStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );
  const [isApprovedTutor, setIsApprovedTutor] = useState(false);
  const activeTab: DashboardTab =
    isApprovedTutor && searchParams.get("tab") === "tutor" ? "tutor" : "student";

  function selectTab(tab: DashboardTab) {
    if (tab === activeTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/dashboard?${params.toString()}`, { scroll: false });
  }
  const tabRefs = useRef<Record<DashboardTab, HTMLButtonElement | null>>({
    student: null,
    tutor: null,
  });

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

  useEffect(() => {
    if (!localStorage.getItem("authToken")) return;
    let cancelled = false;
    getBookings("STUDENT")
      .then((bookings) => {
        if (cancelled) return;
        const now = Date.now();
        const next = bookings
          .filter(
            (booking) => booking.status === "CONFIRMED" && Date.parse(booking.startedAt) > now
          )
          .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))[0];
        setNextLesson(next ?? null);
        setNextLessonStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setNextLessonStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    let cancelled = false;

    fetch("/api/profiles/me/tutor", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { status?: string } | null) => {
        if (cancelled) return;

        const approved = data?.status === "APPROVED";
        setIsApprovedTutor(approved);
      })
      .catch(() => {
        if (!cancelled) setIsApprovedTutor(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, tab: DashboardTab) {
    const currentIndex = dashboardTabs.indexOf(tab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % dashboardTabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + dashboardTabs.length) % dashboardTabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = dashboardTabs.length - 1;

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = dashboardTabs[nextIndex];
    selectTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <RequireAuth>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[68rem] flex-1 flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8"
      >
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">Dashboard</h1>

        {isApprovedTutor && (
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="flex w-fit gap-1 rounded-lg bg-surface-muted p-1"
          >
            {dashboardTabs.map((tab) => {
              const selected = activeTab === tab;
              const label = tab === "student" ? "Student" : "Tutor";

              return (
                <button
                  key={tab}
                  ref={(element) => {
                    tabRefs.current[tab] = element;
                  }}
                  type="button"
                  role="tab"
                  id={`${tab}-dashboard-tab`}
                  aria-controls={`${tab}-dashboard-panel`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(tab)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab)}
                  className={`min-h-11 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                    selected ? "bg-brand-navy text-white" : "text-secondary hover:bg-surface-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <section
          id="student-dashboard-panel"
          role={isApprovedTutor ? "tabpanel" : undefined}
          aria-labelledby={isApprovedTutor ? "student-dashboard-tab" : undefined}
          tabIndex={isApprovedTutor ? 0 : undefined}
          hidden={isApprovedTutor && activeTab !== "student"}
          className="flex flex-col gap-5"
        >
          <h2 className="sr-only">Student dashboard</h2>

          <section
            aria-labelledby="next-lesson-heading"
            className="min-h-44 rounded-2xl border border-line bg-surface p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id="next-lesson-heading" className="text-lg font-semibold">
                  Next lesson
                </h3>
                {nextLessonStatus === "loading" && (
                  <p className="mt-2 text-sm text-muted">Loading your schedule…</p>
                )}
                {nextLessonStatus === "error" && (
                  <p role="status" className="mt-2 text-sm text-muted">
                    We could not load your next lesson. You can still view all bookings.
                  </p>
                )}
                {nextLessonStatus === "loaded" && nextLesson && (
                  <>
                    <p className="mt-2 break-words font-medium">{nextLesson.subject.name}</p>
                    <p className="mt-1 text-sm text-secondary">
                      with {nextLesson.subject.tutor.name}
                    </p>
                    <p className="mt-2 text-sm text-secondary">
                      {studentDateFormat.format(new Date(nextLesson.startedAt))}
                    </p>
                  </>
                )}
                {nextLessonStatus === "loaded" && !nextLesson && (
                  <p className="mt-2 text-sm text-secondary">No upcoming lessons yet.</p>
                )}
              </div>
              {nextLesson ? (
                <Link href={`/bookings/${nextLesson.id}`} className="ui-button-secondary shrink-0">
                  View lesson
                </Link>
              ) : nextLessonStatus === "loaded" ? (
                <Link href="/search" className="ui-button shrink-0">
                  Find a tutor
                </Link>
              ) : (
                <Link href="/bookings" className="ui-button-secondary shrink-0">
                  View bookings
                </Link>
              )}
            </div>
          </section>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {[
              {
                href: "/search",
                title: "Find a tutor",
                description: "Compare Subjects and find a time to learn.",
              },
              {
                href: "/bookings",
                title: "Your bookings",
                description: "See lesson times, meeting links and next steps.",
              },
              {
                href: "/wallet",
                title: "Your wallet",
                description: "Check your balance, top-ups and transactions.",
              },
            ].map(({ href, title, description }) => (
              <Link
                key={href}
                href={href}
                className="flex min-w-0 flex-col gap-1 border-b border-line px-4 py-4 transition-colors last:border-b-0 hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-link sm:px-5"
              >
                <h3 className="flex items-center justify-between gap-3 text-base font-semibold">
                  {title}
                </h3>
                <p className="text-sm leading-6 text-secondary">{description}</p>
              </Link>
            ))}
          </div>

          {status === "loading" && <p className="text-muted">Loading your dashboard…</p>}

          {status === "error" && (
            <p role="alert" className="text-red-600 dark:text-red-400">
              We could not load your profile. Please refresh and try again.
            </p>
          )}

          {status === "incomplete" && (
            <section className="flex flex-col gap-3 border-l-2 border-line pl-5">
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold">Complete your Student profile</h3>
                <p className="leading-7 text-secondary">
                  Tell us what you want to learn so we can help you find Tutors that fit your goals.
                </p>
              </div>
              <Link
                href="/settings/student"
                className="flex h-11 w-fit items-center justify-center rounded-lg bg-brand-navy px-5 font-medium text-white transition-colors hover:bg-brand-navy-dark"
              >
                Set up your profile
              </Link>
            </section>
          )}

          {status === "complete" && (
            <section className="flex flex-col gap-3 border-t border-line pt-5">
              <div>
                <h3 className="text-lg font-semibold">Your Student profile is ready</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  You can now explore Tutors matched to your learning preferences.
                </p>
              </div>
              <Link
                href="/settings/account"
                className="flex h-11 w-fit items-center justify-center rounded-lg bg-brand-navy px-5 font-medium text-white transition-colors hover:bg-brand-navy-dark"
              >
                Edit your profile
              </Link>
            </section>
          )}
        </section>

        {isApprovedTutor && (
          <section
            id="tutor-dashboard-panel"
            role="tabpanel"
            aria-labelledby="tutor-dashboard-tab"
            tabIndex={0}
            hidden={activeTab !== "tutor"}
            className="flex flex-col gap-5"
          >
            <h2 className="sr-only">Tutor dashboard</h2>
            {activeTab === "tutor" && (
              <TutorDashboardStats>
                <TutorUpcomingClasses />
                <TutorAvailabilityEditor />
                <TutorNeedsConfirmation />
              </TutorDashboardStats>
            )}
          </section>
        )}
      </main>
    </RequireAuth>
  );
}
