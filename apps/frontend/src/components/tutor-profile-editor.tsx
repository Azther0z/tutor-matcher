"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { TutorConsent } from "@/src/components/tutor-consent";
import { TutorCertificationLinks } from "@/src/components/tutor-certification-links";
import { TutorDetailsFields } from "@/src/components/tutor-details-fields";
import {
  tutorApi,
  getTutorCertificationUrls,
  tutorDetailsFromApplication,
  tutorDetailsPayload,
  type TutorApplicationResponse,
  type TutorProfileFields,
} from "@/src/lib/tutor-application";
import {
  emptyTutorDetails,
  validateTutorDetails,
  type TutorDetails,
  type TutorDetailsFieldErrors,
} from "@/src/lib/tutor-details";

const shell = "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16";
const panel = "rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]";
const button =
  "rounded-full border border-black/[.12] px-6 py-3 font-medium hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.18] dark:hover:bg-white/[.08]";
const apiPath = "/api/profiles/me/tutor";

function buildDraftPayload(details: TutorDetails, loadedProfile: TutorProfileFields | null) {
  const payload = tutorDetailsPayload(details);
  const certificationUrls = getTutorCertificationUrls(loadedProfile).flatMap((url) =>
    url === loadedProfile?.certificationUrl
      ? payload.certificationUrl
        ? [payload.certificationUrl]
        : []
      : [url]
  );
  if (!loadedProfile?.certificationUrl && payload.certificationUrl) {
    certificationUrls.push(payload.certificationUrl);
  }
  return { ...payload, certificationUrls: [...new Set(certificationUrls)] };
}

function profileContent(profile: TutorProfileFields) {
  const fields = tutorDetailsPayload(tutorDetailsFromApplication(profile));
  return JSON.stringify([
    fields.avatarUrl,
    fields.bio,
    fields.introVideoUrl,
    fields.identificationCardUrl,
    [...new Set(getTutorCertificationUrls(profile))].sort(),
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
  const [errors, setErrors] = useState<TutorDetailsFieldErrors>({});
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string>();
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
        setDetails(tutorDetailsFromApplication(result.version ?? result.tutor));
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

  async function saveDraft() {
    const result = await tutorApi<TutorApplicationResponse>(`${apiPath}/draft`, {
      method: "PUT",
      body: JSON.stringify(buildDraftPayload(details, data?.version ?? data?.tutor ?? null)),
    });
    setData(result);
    setDetails(tutorDetailsFromApplication(result.version ?? result.tutor));
    setErrors({});
    setConsentError(undefined);
    return result;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateTutorDetails(details);
    setErrors(nextErrors);
    setConsentError(
      consent ? undefined : "Consent is required before submitting your profile for review."
    );
    if (Object.keys(nextErrors).length || !consent || noChanges) return;
    void runAction(async () => {
      await saveDraft();
      const result = await tutorApi<TutorApplicationResponse>(`${apiPath}/submit`, {
        method: "POST",
        body: JSON.stringify({ consentAccepted: true }),
      });
      setData(result);
      setConsent(false);
      setMessage("Submitted for admin review. No changes are applied until approval.");
    });
  }

  const tutor = data?.tutor;
  const version = data?.version;
  const pending = version?.status === "PENDING";
  const approvedEnrollment = enrollment && !!tutor;
  const editableProfile = version ?? tutor ?? null;
  const retainedCertificationUrls = getTutorCertificationUrls(editableProfile).filter(
    (url) => url !== editableProfile?.certificationUrl
  );
  const noChanges =
    !!tutor &&
    profileContent(buildDraftPayload(details, editableProfile)) === profileContent(tutor);
  const canSubmit =
    consent && Object.keys(validateTutorDetails(details)).length === 0 && !noChanges;

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
          <Link className="underline" href="/settings/account">
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

      {version?.status === "APPROVED" && (
        <p role="status">
          Your profile was approved.
          {tutor
            ? " The approved changes have been applied automatically."
            : " Refresh to see your Tutor profile."}
        </p>
      )}
      {version?.status === "REJECTED" && (
        <section className={panel} role="status">
          <h2 className="text-xl font-semibold">Request rejected</h2>
          <p className="mt-2">Reason: {version.rejectionReason}</p>
          <p className="mt-2">
            {tutor ? "Your approved profile is unchanged. " : ""}Update the details below and
            re-submit.
          </p>
        </section>
      )}
      {version?.status === "CANCELLED" && (
        <p role="status">Request withdrawn. You can edit and re-submit.</p>
      )}
      {version?.status === "DRAFT" && (
        <p className="text-sm text-zinc-500">Draft saved. It has not been submitted for review.</p>
      )}

      {pending && (
        <section className={panel} aria-label="Pending request">
          <h2 className="text-xl font-semibold">Pending Verification</h2>
          <p className="mt-2">
            {tutor
              ? "Your current approved profile stays unchanged while these edits are reviewed. You can keep teaching and change publication independently."
              : "Your application is awaiting admin approval. You remain a student until it is approved."}
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium">Submitted bio</dt>
              <dd className="whitespace-pre-wrap">{version.bio}</dd>
            </div>
            {(
              [
                ["Intro video", version.introVideoUrl],
                ["Identification card (private)", version.identificationCardUrl],
              ] as const
            ).map(([label, url]) => (
              <div key={label}>
                <dt className="font-medium">{label}</dt>
                <dd>
                  {url && /^https?:\/\//i.test(url) ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all underline"
                    >
                      {url}
                    </a>
                  ) : (
                    "Not provided"
                  )}
                </dd>
              </div>
            ))}
            <div>
              <dt className="font-medium">Teaching certification (private)</dt>
              <dd>
                <TutorCertificationLinks urls={getTutorCertificationUrls(version)} />
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-sm">
            Submitted requests cannot be edited. Withdraw this request to make changes and
            re-submit.
          </p>
          <button
            className={`${button} mt-4`}
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                const result = await tutorApi<TutorApplicationResponse>(`${apiPath}/withdraw`, {
                  method: "POST",
                });
                setData(result);
                setDetails(tutorDetailsFromApplication(result.version ?? result.tutor));
                setConsent(false);
                setMessage("Request withdrawn. Edit your details and submit again when ready.");
              })
            }
          >
            Withdraw request
          </button>
        </section>
      )}

      {!pending && !approvedEnrollment && (
        <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {tutor
              ? "Your current profile stays live during review. Once approved, these changes apply automatically, keeping your publication setting."
              : "Save an incomplete draft at any time. Submit a complete application for admin review. Approval lets you set up your subjects before publishing."}
          </p>
          {noChanges && (
            <p className="text-sm text-zinc-500">
              Change at least one profile field before submitting for review.
            </p>
          )}
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
            <TutorDetailsFields
              values={details}
              errors={errors}
              onChange={(name, value) => setDetails((current) => ({ ...current, [name]: value }))}
            />
            {retainedCertificationUrls.length > 0 && (
              <section className={panel} aria-label="Additional teaching certifications (private)">
                <h2 className="text-xl font-semibold">
                  Additional teaching certifications (private)
                </h2>
                <p className="my-3 text-sm text-zinc-500">
                  The URL field edits one certification. These other certifications are retained
                  when you save or submit your profile.
                </p>
                <TutorCertificationLinks urls={retainedCertificationUrls} />
              </section>
            )}
            <TutorConsent
              consentAccepted={consent}
              setConsentAccepted={setConsent}
              error={consentError}
            />
            <div className="flex flex-wrap justify-end gap-3">
              <Link className={button} href={tutor ? "/dashboard/tutor" : "/dashboard"}>
                Back to dashboard
              </Link>
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
                className={`${button} bg-foreground text-background`}
                disabled={busy || !canSubmit}
              >
                {busy ? "Saving…" : tutor ? "Submit changes for review" : "Submit application"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {actionError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <button
        className={`${button} self-start`}
        disabled={busy}
        onClick={() => {
          setData(null);
          setMessage(null);
          setActionError(null);
          setConsent(false);
          setErrors({});
          setConsentError(undefined);
          setReload((value) => value + 1);
        }}
      >
        Refresh review status
      </button>
    </main>
  );
}
