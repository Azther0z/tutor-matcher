"use client";

import { RequireAuth } from "@/src/components/require-auth";
import { TutorAvailabilityEditor } from "@/src/components/tutor-availability-editor";
import { TutorNeedsConfirmation } from "@/src/components/tutor-needs-confirmation";
import { TutorUpcomingClasses } from "@/src/components/tutor-upcoming-classes";
import { TutorDashboardStats } from "@/src/components/tutor-dashboard-stats";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type StudentProfileStatus = "loading" | "incomplete" | "complete" | "error";
type DashboardTab = "student" | "tutor";

const dashboardTabs: DashboardTab[] = ["student", "tutor"];

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StudentProfileStatus>("loading");
  const [activeTab, setActiveTab] = useState<DashboardTab>("student");
  const [isApprovedTutor, setIsApprovedTutor] = useState(false);
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

        if (approved && new URLSearchParams(window.location.search).get("tab") === "tutor") {
          setActiveTab("tutor");
        }
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
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <RequireAuth>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted">Tutor Matcher</p>
          <h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-lg leading-8 text-secondary">
            {isApprovedTutor
              ? "Choose whether to manage your learning or teaching."
              : "Find Tutors and manage your learning journey."}
          </p>
        </div>

        {isApprovedTutor && (
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="flex w-fit gap-1 rounded-xl border border-line p-1"
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
                  onClick={() => setActiveTab(tab)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab)}
                  className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
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
          className="flex flex-col gap-8"
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">Student dashboard</h2>
            <p className="text-secondary">Find Tutors and manage your learning journey.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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
                className="ui-card flex flex-col gap-3 p-6 transition-colors hover:border-brand-link"
              >
                <h3 className="flex items-center justify-between gap-3 text-lg font-medium">
                  {title}
                  <span aria-hidden="true" className="text-brand-link">
                    →
                  </span>
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
            <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-semibold">Complete your Student profile</h3>
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
            <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
              <div>
                <h3 className="text-2xl font-semibold">Your Student profile is ready</h3>
                <p className="mt-2 leading-7 text-secondary">
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
            className="flex flex-col gap-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold">Tutor dashboard</h2>
                <p className="text-secondary">
                  Manage your teaching availability, subjects, and Tutor profile.
                </p>
              </div>
              <Link
                href="/settings/tutor"
                className="text-sm font-semibold text-brand-link underline"
              >
                Manage subjects and listing
              </Link>
            </div>
            {activeTab === "tutor" && <TutorDashboardStats />}
            <TutorNeedsConfirmation />
            <TutorUpcomingClasses />
            <TutorAvailabilityEditor />
          </section>
        )}
      </main>
    </RequireAuth>
  );
}
