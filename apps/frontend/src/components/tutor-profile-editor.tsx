"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { SettingsSidebar } from "@/src/components/settings-sidebar";
import { TutorSubjectsManager } from "@/src/components/tutor-subjects-manager";
import {
  DraftDialog,
  SubmitDraftDialog,
  UnsavedChangesDialog,
} from "@/src/components/tutor-profile-dialogs";
import { SavedDrafts } from "@/src/components/tutor-profile-drafts";
import { SubmissionHistory } from "@/src/components/tutor-profile-history";
import {
  ApprovedProfilePanel,
  PendingApplicationPanel,
  ReviewOutcome,
} from "@/src/components/tutor-profile-panels";
import { button, shell } from "@/src/lib/tutor-profile-style";
import { useTutorProfile } from "@/src/lib/use-tutor-profile";

function ProfileLayout({ enrollment, children }: { enrollment: boolean; children: ReactNode }) {
  return (
    <main
      className={
        enrollment
          ? shell
          : "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16 sm:flex-row"
      }
    >
      {!enrollment && <SettingsSidebar activeSection="tutor" />}
      <div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
    </main>
  );
}

export function TutorProfileEditor({ enrollment = false }: { enrollment?: boolean }) {
  return (
    <RequireAuth>
      <ProfileEditor enrollment={enrollment} />
    </RequireAuth>
  );
}

function ProfileEditor({ enrollment }: { enrollment: boolean }) {
  const profile = useTutorProfile(enrollment);
  const {
    replace,
    data,
    tutor,
    pending,
    busy,
    profileBusy,
    loadError,
    message,
    actionError,
    editorOpen,
    submitOpen,
    closeTransition,
    dirty,
    subjects,
    approvedEnrollment,
    setSubjects,
    setSubjectBusy,
    requestTransition,
    retryLoad,
  } = profile;

  if (loadError)
    return (
      <ProfileLayout enrollment={enrollment}>
        <p role="alert">{loadError}</p>
        <button className={button} onClick={retryLoad}>
          Try again
        </button>
      </ProfileLayout>
    );
  if (!data)
    return (
      <ProfileLayout enrollment={enrollment}>
        <p className="text-zinc-500">Loading your application…</p>
      </ProfileLayout>
    );

  if (!enrollment && !tutor)
    return (
      <ProfileLayout enrollment={enrollment}>
        <p>Redirecting to your Tutor application…</p>
      </ProfileLayout>
    );

  return (
    <ProfileLayout enrollment={enrollment}>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {enrollment ? "Become a Tutor" : "Tutor profile"}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Subjects and hourly rates are configured separately. Change your name in{" "}
          <Link
            className="underline"
            href="/settings/account"
            onClick={(event) => {
              if (busy || (editorOpen && dirty)) {
                event.preventDefault();
                if (!busy) requestTransition(() => replace("/settings/account"));
              }
            }}
          >
            account settings
          </Link>
          .
        </p>
      </div>

      {enrollment && !tutor && pending && <PendingApplicationPanel profile={profile} />}
      {tutor && <ApprovedProfilePanel profile={profile} enrollment={enrollment} />}

      {tutor && !enrollment && (
        <TutorSubjectsManager
          subjects={subjects}
          setSubjects={setSubjects}
          disabled={profileBusy || editorOpen || submitOpen || !!closeTransition}
          onBusyChange={setSubjectBusy}
        />
      )}

      <ReviewOutcome profile={profile} />
      <SubmissionHistory profile={profile} />
      {!approvedEnrollment && <SavedDrafts profile={profile} />}

      {!approvedEnrollment && editorOpen && !closeTransition && <DraftDialog profile={profile} />}
      {closeTransition && <UnsavedChangesDialog profile={profile} />}
      {submitOpen && <SubmitDraftDialog profile={profile} />}
      {!editorOpen && !submitOpen && actionError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}
      {!editorOpen && message && <p role="status">{message}</p>}
    </ProfileLayout>
  );
}
