"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { TutorProfileSnapshot } from "@/src/components/tutor-profile-comparison";
import { TutorRefreshButton } from "@/src/components/tutor-refresh-button";
import { TutorSubmissionStatus } from "@/src/components/tutor-submission-status";
import { TutorDialog } from "@/src/components/tutor-dialog";
import { TutorConsent } from "@/src/components/tutor-consent";
import { TutorDetailsFields } from "@/src/components/tutor-details-fields";
import {
  tutorApi,
  tutorDetailsFromApplication,
  tutorDetailsPayload,
  type TutorApplicationResponse,
  type TutorProfileFields,
  type TutorProfileVersion,
} from "@/src/lib/tutor-application";
import {
  emptyTutorDetails,
  validateTutorDetails,
  type TutorDetails,
  type TutorDetailsFieldErrors,
} from "@/src/lib/tutor-details";

const shell = "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16";
const panel = "rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]";
const buttonBase =
  "rounded-full border border-black/[.12] px-6 py-3 font-medium disabled:opacity-60 dark:border-white/[.18]";
const button = `${buttonBase} hover:bg-black/[.04] dark:hover:bg-white/[.08]`;
const primaryButton = `${buttonBase} bg-foreground text-background hover:opacity-80`;
const apiPath = "/api/profiles/me/tutor";

function profileContent(profile: TutorProfileFields) {
  const fields = tutorDetailsPayload(tutorDetailsFromApplication(profile));
  return JSON.stringify([
    fields.avatarUrl,
    fields.bio,
    fields.introVideoUrl,
    fields.identificationCardUrl,
  ]);
}

export function TutorProfileEditor({ enrollment = false }: { enrollment?: boolean }) {
  return (
    <RequireAuth>
      <ProfileEditor enrollment={enrollment} />
    </RequireAuth>
  );
}

function ProfileEditor({ enrollment }: { enrollment: boolean }) {
  const { replace } = useRouter();
  const [data, setData] = useState<TutorApplicationResponse | null>(null);
  const [details, setDetails] = useState<TutorDetails>(emptyTutorDetails);
  const [editorOpen, setEditorOpen] = useState(false);
  const [closeTransition, setCloseTransition] = useState<(() => void) | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [rowSubmission, setRowSubmission] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(JSON.stringify(emptyTutorDetails));
  const dirty = JSON.stringify(details) !== baseline;
  const [errors, setErrors] = useState<TutorDetailsFieldErrors>({});
  const [consent, setConsent] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    tutorApi<TutorApplicationResponse>(apiPath, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!enrollment && !result.tutor) {
          replace("/enroll-tutor");
        }
        setData(result);
        const draft = result.drafts[0];
        loadDetails(
          draft ? tutorDetailsFromApplication(draft) : emptyTutorDetails,
          draft?.id ?? null
        );
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : "Could not load your profile.");
      });
    return () => controller.abort();
  }, [reload, enrollment, replace]);

  async function runAction(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not reach the server. Please try again."
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function loadDetails(next: TutorDetails, id: string | null) {
    setDetails(next);
    setBaseline(JSON.stringify(next));
    setSelectedId(id);
    setConsent(false);
    setErrors({});
  }

  function updateDetails(next: TutorDetails) {
    setDetails(next);
    setErrors((current) => (Object.keys(current).length ? validateTutorDetails(next) : current));
    setActionError(null);
  }

  function requestTransition(transition: () => void) {
    if (editorOpen && (dirty || !selectedId)) setCloseTransition(() => transition);
    else transition();
  }

  function closeEditor() {
    requestTransition(() => {
      loadDetails(emptyTutorDetails, null);
      setEditorOpen(false);
      setActionError(null);
      setMessage(null);
    });
  }

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  async function saveDraft() {
    const result = await tutorApi<TutorApplicationResponse>(
      selectedId ? `${apiPath}/drafts/${selectedId}` : `${apiPath}/drafts`,
      {
        method: selectedId ? "PUT" : "POST",
        body: JSON.stringify(tutorDetailsPayload(details)),
      }
    );
    const saved = result.version;
    if (!saved || saved.status !== "DRAFT")
      throw new Error("Could not identify the saved draft. Please refresh.");
    setData(result);
    // Save normalizes the snapshot but keeps consent for this explicit submit action.
    const next = tutorDetailsFromApplication(saved);
    setDetails(next);
    setBaseline(JSON.stringify(next));
    setSelectedId(saved.id);
    setErrors({});
    return saved;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateTutorDetails(details);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || noChanges || pending) return;
    setRowSubmission(false);
    setConsent(false);
    setEditorOpen(false);
    setSubmitOpen(true);
  }

  function editSubmission() {
    setSubmitOpen(false);
    setConsent(false);
    setActionError(null);
    setEditorOpen(true);
  }

  function cancelSubmission() {
    setSubmitOpen(false);
    setConsent(false);
    if (!rowSubmission) setEditorOpen(true);
  }

  function confirmSubmit() {
    if (!consent || pending || noChanges || Object.keys(validateTutorDetails(details)).length)
      return;
    void runAction(async () => {
      const id = rowSubmission ? selectedId : (await saveDraft()).id;
      if (!id) throw new Error("Select a saved draft before submitting.");
      const result = await tutorApi<TutorApplicationResponse>(`${apiPath}/drafts/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ consentAccepted: true }),
      });
      setData(result);
      loadDetails(emptyTutorDetails, null);
      setSubmitOpen(false);
      setEditorOpen(false);
      setMessage("Submitted for admin review. No changes are applied until approval.");
    });
  }

  const tutor = data?.tutor;
  const pending = data?.pendingRequest;
  const latestReview = data?.latestReview;
  const approvedEnrollment = enrollment && !!tutor;
  const noChanges =
    !!tutor && profileContent(tutorDetailsPayload(details)) === profileContent(tutor);
  const canSubmit =
    Object.keys(validateTutorDetails(details)).length === 0 && !noChanges && !pending;

  if (loadError)
    return (
      <main className={shell}>
        <p role="alert">{loadError}</p>
        <button
          className={button}
          onClick={() => {
            setLoadError(null);
            setReload((value) => value + 1);
          }}
        >
          Try again
        </button>
      </main>
    );
  if (!data)
    return (
      <main className={shell}>
        <p className="text-zinc-500">Loading your application…</p>
      </main>
    );

  if (!enrollment && !tutor)
    return (
      <main className={shell}>
        <p>Redirecting to your Tutor application…</p>
      </main>
    );

  return (
    <main className={shell}>
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

      {tutor && (
        <section className={panel} aria-label="Current approved profile">
          <h2 className="text-xl font-semibold">
            Current approved profile{" "}
            {tutor.verified && (
              <span className="ml-2 rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-700 dark:text-green-300">
                Verified
              </span>
            )}
          </h2>
          <p className="mt-3 whitespace-pre-wrap">{tutor.bio}</p>
          <p className="mt-3 text-sm">
            Publication:{" "}
            <strong>{tutor.status === "PUBLISHED" ? "Published" : "Unpublished"}</strong>
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Unpublishing stops discovery and new bookings. Existing chats and booked lessons remain
            accessible.
          </p>
          <button
            className={`${button} mt-4`}
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                const result = await tutorApi<TutorApplicationResponse>(`${apiPath}/publication`, {
                  method: "PATCH",
                  body: JSON.stringify({ published: tutor.status !== "PUBLISHED" }),
                });
                setData(result);
                setMessage(
                  result.tutor?.status === "PUBLISHED"
                    ? "Your profile is now published."
                    : "Your profile is now unpublished."
                );
              })
            }
          >
            {tutor.status === "PUBLISHED" ? "Unpublish profile" : "Publish profile"}
          </button>
          {approvedEnrollment && (
            <p className="mt-4">
              Your application is approved.{" "}
              <Link href="/settings/tutor" className="underline">
                Manage your Tutor profile
              </Link>{" "}
              or{" "}
              <Link href="/dashboard/tutor" className="underline">
                open your Tutor dashboard
              </Link>
              .
            </p>
          )}
        </section>
      )}

      {latestReview?.status === "APPROVED" && (
        <p role="status">
          Your profile was approved.
          {tutor
            ? " The approved changes have been applied automatically."
            : " Refresh to see your Tutor profile."}
        </p>
      )}
      {latestReview?.status === "REJECTED" && (
        <section className={panel} role="status">
          <h2 className="text-xl font-semibold">Request rejected</h2>
          <p className="mt-2">Reason: {latestReview.rejectionReason}</p>
          <p className="mt-2">
            {tutor ? "Your approved profile is unchanged. " : ""}Update the details below and
            re-submit.
          </p>
        </section>
      )}
      <section className={panel} aria-label="Submission history">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Submission history</h2>
          <TutorRefreshButton
            label="Refresh review status"
            disabled={busy}
            onClick={() => {
              requestTransition(() => {
                setEditorOpen(false);
                setData(null);
                setMessage(null);
                setActionError(null);
                setConsent(false);
                setErrors({});
                setReload((value) => value + 1);
              });
            }}
          />
        </div>
        {data.submissions?.length ? (
          <ul className="mt-4 divide-y divide-black/[.12] dark:divide-white/[.18]">
            {data.submissions.map((submission) => (
              <li key={submission.id} className="py-3">
                <details>
                  <summary className="cursor-pointer font-medium">
                    <TutorSubmissionStatus status={submission.status} />
                    {submission.submittedAt &&
                      ` · Submitted ${new Date(submission.submittedAt).toLocaleString()}`}
                  </summary>
                  <div className="mt-4">
                    {submission.status === "PENDING" && (
                      <p className="mb-4 text-sm text-zinc-500">
                        {tutor
                          ? "Your current approved profile stays unchanged while these edits are reviewed. You can keep teaching and change publication independently."
                          : "Your application is awaiting admin approval. You remain a student until it is approved."}{" "}
                        Submitted requests cannot be edited. Withdrawing cancels the request; you
                        can then create a separate draft from its history.
                      </p>
                    )}
                    <TutorProfileSnapshot profile={submission} />
                    {submission.status === "PENDING" && (
                      <button
                        className={`${button} mt-4`}
                        disabled={busy}
                        onClick={() =>
                          void runAction(async () => {
                            const result = await tutorApi<TutorApplicationResponse>(
                              `${apiPath}/withdraw`,
                              {
                                method: "POST",
                              }
                            );
                            setData(result);
                            if (!dirty && !selectedId) loadDetails(emptyTutorDetails, null);
                            setConsent(false);
                            setMessage(
                              "Request cancelled. You can create a new draft from its submission history."
                            );
                          })
                        }
                      >
                        Withdraw request
                      </button>
                    )}
                    {submission.reviewedAt && (
                      <p className="mt-3 text-sm">
                        Reviewed {new Date(submission.reviewedAt).toLocaleString()}
                      </p>
                    )}
                    {submission.rejectionReason && (
                      <p className="mt-3">Reason: {submission.rejectionReason}</p>
                    )}
                    {submission.status === "CANCELLED" &&
                      (approvedEnrollment ? (
                        <Link href="/settings/tutor" className="mt-4 inline-block underline">
                          Create a draft in Tutor settings
                        </Link>
                      ) : (
                        <button
                          className={`${button} mt-4`}
                          disabled={busy}
                          onClick={() =>
                            requestTransition(() => {
                              void runAction(async () => {
                                const result = await tutorApi<TutorApplicationResponse>(
                                  `${apiPath}/submissions/${submission.id}/copy`,
                                  { method: "POST" }
                                );
                                setData(result);
                                loadDetails(
                                  tutorDetailsFromApplication(result.version),
                                  result.version!.id
                                );
                                setEditorOpen(true);
                                setMessage("New draft created from the cancelled submission.");
                              });
                            })
                          }
                        >
                          Create draft from cancelled submission
                        </button>
                      ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No submissions yet.</p>
        )}
      </section>

      {!approvedEnrollment && (
        <section className={panel} aria-label="Saved drafts">
          <h2 className="text-xl font-semibold">Your drafts</h2>
          <p className="my-3 text-sm text-zinc-500">
            Select one saved snapshot to edit. Pending requests and reviewed versions cannot be
            edited.
          </p>
          {data.drafts.length === 0 ? (
            <p>No saved drafts yet.</p>
          ) : (
            <ul className="divide-y divide-black/[.08] dark:divide-white/[.12]">
              {data.drafts.map((draft: TutorProfileVersion, index: number) => {
                const unchanged = !!tutor && profileContent(draft) === profileContent(tutor);
                const label = `draft ${index + 1}: ${draft.bio?.trim().slice(0, 100) || "Untitled draft"}`;
                return (
                  <li
                    key={draft.id}
                    className="flex items-center justify-between gap-4 rounded-md py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {draft.bio?.trim().slice(0, 100) || "Untitled draft"}
                      </p>
                      <time className="text-sm text-zinc-500" dateTime={draft.createdAt}>
                        {new Date(draft.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${label}`}
                        aria-haspopup="dialog"
                        className="rounded-md border border-black/[.12] px-3 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.18] dark:hover:bg-white/[.08]"
                        disabled={busy}
                        onClick={() =>
                          requestTransition(() => {
                            loadDetails(tutorDetailsFromApplication(draft), draft.id);
                            setMessage(null);
                            setActionError(null);
                            setEditorOpen(true);
                          })
                        }
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
                          <path d="m14 5 5 5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={`Trash ${label}`}
                        className="rounded-md border border-black/[.12] px-3 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:border-white/[.18] dark:text-red-300"
                        disabled={busy}
                        onClick={() => {
                          if (
                            !window.confirm(`Permanently discard ${label}? This cannot be undone.`)
                          )
                            return;
                          void runAction(async () => {
                            const result = await tutorApi<TutorApplicationResponse>(
                              `${apiPath}/drafts/${draft.id}`,
                              { method: "DELETE" }
                            );
                            setData(result);
                            if (selectedId === draft.id) loadDetails(emptyTutorDetails, null);
                            setMessage("Draft discarded.");
                          });
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={`Submit ${label}`}
                        aria-haspopup="dialog"
                        disabled={busy || !!pending || unchanged}
                        title={
                          pending
                            ? "Only one request can be pending. Withdraw it before submitting another."
                            : unchanged
                              ? "Change your profile before submitting for review."
                              : "Submit this draft for review"
                        }
                        className="rounded-md border border-black/[.12] px-3 py-2 text-sm hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.18] dark:hover:bg-white/[.08]"
                        onClick={() =>
                          requestTransition(() => {
                            const next = tutorDetailsFromApplication(draft);
                            loadDetails(next, draft.id);
                            const nextErrors = validateTutorDetails(next);
                            setErrors(nextErrors);
                            setActionError(null);
                            setMessage(null);
                            if (Object.keys(nextErrors).length) {
                              setEditorOpen(true);
                              setActionError("Complete this draft before submitting for review.");
                            } else {
                              setRowSubmission(true);
                              setSubmitOpen(true);
                            }
                          })
                        }
                      >
                        Submit
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            className={`${button} mt-4`}
            disabled={busy}
            onClick={() =>
              requestTransition(() => {
                loadDetails(emptyTutorDetails, null);
                setMessage(null);
                setActionError(null);
                setEditorOpen(true);
              })
            }
            aria-haspopup="dialog"
            data-tutor-dialog-trigger
          >
            New draft
          </button>
        </section>
      )}

      {!approvedEnrollment && editorOpen && !closeTransition && (
        <TutorDialog
          title="Draft"
          status={selectedId && !dirty ? "Saved" : "Not saved"}
          titleId="tutor-draft-dialog-title"
          busy={busy}
          onClose={closeEditor}
          footer={
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() =>
                  void runAction(async () => {
                    await saveDraft();
                    setMessage("Draft saved. It has not been submitted for review.");
                  })
                }
              >
                Save draft
              </button>
              <button
                type="submit"
                form="tutor-draft-form"
                className={primaryButton}
                disabled={busy || !canSubmit}
              >
                Submit
              </button>
            </div>
          }
        >
          <form id="tutor-draft-form" onSubmit={submit} className="flex flex-col gap-6" noValidate>
            {pending && (
              <p role="status">
                One request is already pending. You can create, edit, save, and discard drafts while
                it is reviewed.
              </p>
            )}
            {noChanges && (
              <p className="text-sm text-zinc-500">
                Change at least one profile field before submitting for review.
              </p>
            )}
            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
              <TutorDetailsFields
                unframed
                values={details}
                errors={errors}
                onChange={(name, value) => updateDetails({ ...details, [name]: value })}
              />
            </fieldset>
          </form>
          {actionError && !closeTransition && !submitOpen && (
            <p role="alert" className="mt-4 text-red-600 dark:text-red-400">
              {actionError}
            </p>
          )}
          {message && (
            <p role="status" className="mt-4">
              {message}
            </p>
          )}
        </TutorDialog>
      )}
      {closeTransition && (
        <TutorDialog
          title="Unsaved changes"
          titleId="tutor-close-title"
          busy={busy}
          onClose={() => setCloseTransition(null)}
          footer={
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => {
                  loadDetails(emptyTutorDetails, null);
                  const transition = closeTransition;
                  setCloseTransition(null);
                  transition();
                }}
              >
                Discard
              </button>
              <button
                type="button"
                className={primaryButton}
                disabled={busy}
                onClick={() =>
                  void runAction(async () => {
                    await saveDraft();
                    const transition = closeTransition;
                    setCloseTransition(null);
                    transition();
                    setMessage("Draft saved. It has not been submitted for review.");
                  })
                }
              >
                Save
              </button>
            </div>
          }
        >
          <p>
            Save your changes before closing? Discard drops only unsaved edits; your saved draft
            stays in the list. Closing with × returns to editing.
          </p>
          {actionError && (
            <p role="alert" className="mt-4 text-red-600 dark:text-red-400">
              {actionError}
            </p>
          )}
        </TutorDialog>
      )}
      {submitOpen && (
        <TutorDialog
          title="Submit draft for review?"
          titleId="tutor-submit-title"
          busy={busy}
          onClose={cancelSubmission}
          footer={
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className={button} disabled={busy} onClick={editSubmission}>
                Edit draft
              </button>
              <button
                type="button"
                className={primaryButton}
                disabled={busy || !consent || !!pending}
                onClick={confirmSubmit}
              >
                Confirm submit
              </button>
            </div>
          }
        >
          <p className="mb-5">
            You can submit only one request at a time. Submitted requests cannot be edited. You can
            cancel a pending request, then create a new draft from it in submission history. Your
            approved profile stays unchanged until approval.
          </p>
          <TutorConsent unframed consentAccepted={consent} setConsentAccepted={setConsent} />
          {actionError && (
            <p role="alert" className="mt-4 text-red-600 dark:text-red-400">
              {actionError}
            </p>
          )}
        </TutorDialog>
      )}
      {!editorOpen && !submitOpen && actionError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}
      {!editorOpen && message && <p role="status">{message}</p>}
    </main>
  );
}
