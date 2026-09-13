"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";

type FieldName =
  | "avatarUrl"
  | "tutorBio"
  | "introVideoUrl"
  | "governmentId"
  | "certificationUrl"
  | "consentAccepted";
type FieldErrors = Partial<Record<FieldName, string>>;

type PolicyDocument = "privacy" | "terms";

type TutorApplication = {
  id: string;
  avatarUrl: string | null;
  bio: string | null;
  introVideoUrl: string | null;
  governmentId: string;
  certificationUrl: string | null;
  status: string;
  enrolledAt: string;
};

type Phase =
  | { name: "loading" }
  | { name: "error" }
  | { name: "form"; application: TutorApplication | null }
  | { name: "pending"; application: TutorApplication };

const inputClassName =
  "h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground aria-[invalid=true]:border-red-500 dark:border-white/[.18]";

const pageShellClassName = "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16";

function PageHeading({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
      <h1 className="text-4xl font-semibold tracking-tight">Become a Tutor</h1>
      <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">{subtitle}</p>
    </div>
  );
}

function EnrollTutorForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tutorBio, setTutorBio] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [governmentId, setGovernmentId] = useState("");
  const [certificationUrl, setCertificationUrl] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [openDocument, setOpenDocument] = useState<PolicyDocument | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const loadedRef = useRef(false);

  const prefill = useCallback((application: TutorApplication | null) => {
    setAvatarUrl(application?.avatarUrl ?? "");
    setTutorBio(application?.bio ?? "");
    setIntroVideoUrl(application?.introVideoUrl ?? "");
    setGovernmentId(application?.governmentId ?? "");
    setCertificationUrl(application?.certificationUrl ?? "");
  }, []);

  useEffect(() => {
    if (loadedRef.current) return; // load the current application exactly once
    loadedRef.current = true;

    const token = localStorage.getItem("authToken");
    if (!token) return; // RequireAuth handles the redirect to /login

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/profiles/me/tutor", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (!response.ok) {
          setPhase({ name: "error" });
          return;
        }

        const data = (await response.json()) as {
          status: string;
          tutor: TutorApplication | null;
        };
        if (cancelled) return;

        if (data.status === "APPROVED") {
          router.replace("/dashboard/tutor");
          return;
        }

        if (data.status === "PENDING" && data.tutor) {
          setPhase({ name: "pending", application: data.tutor });
          return;
        }

        // NONE (new applicant) or REJECTED — show the editable application form.
        prefill(data.tutor);
        setPhase({ name: "form", application: data.tutor });
      } catch {
        if (!cancelled) setPhase({ name: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, prefill]);

  function validate() {
    const errors: FieldErrors = {};

    const isValidUrl = (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    };

    if (avatarUrl.trim() && !isValidUrl(avatarUrl)) errors.avatarUrl = "Enter a valid avatar URL.";
    if (!tutorBio.trim()) errors.tutorBio = "Tutor bio is required.";
    if (!introVideoUrl.trim()) errors.introVideoUrl = "Intro video URL is required.";
    else if (!isValidUrl(introVideoUrl)) errors.introVideoUrl = "Enter a valid intro video URL.";
    if (!governmentId.trim()) errors.governmentId = "Government ID is required.";
    if (!certificationUrl.trim())
      errors.certificationUrl = "A teaching certification document is required.";
    else if (!isValidUrl(certificationUrl))
      errors.certificationUrl = "Enter a valid certification document URL.";
    if (!consentAccepted)
      errors.consentAccepted =
        "You must consent to the processing of your ID, teaching credentials, and payout information.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!validate()) {
      setMessage("Complete the highlighted fields before submitting your application.");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      setMessage("Please log in before submitting your Tutor application.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/profiles/me/tutor", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarUrl: avatarUrl.trim() || null,
          bio: tutorBio.trim(),
          introVideoUrl: introVideoUrl.trim(),
          governmentId: governmentId.trim(),
          certificationUrl: certificationUrl.trim(),
          consentAccepted,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        message?: string;
        tutor?: TutorApplication;
      } | null;

      if (!response.ok) {
        setMessage(data?.message ?? "Could not submit your Tutor application.");
        return;
      }

      setFieldErrors({});
      setMessage(null);

      if (data?.tutor) {
        setPhase({ name: "pending", application: data.tutor });
      } else {
        setMessage("Tutor application submitted. It is now awaiting approval.");
      }
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase.name === "loading") {
    return (
      <main className={pageShellClassName}>
        <p className="text-zinc-500">Loading your application…</p>
      </main>
    );
  }

  if (phase.name === "error") {
    return (
      <main className={pageShellClassName}>
        <PageHeading subtitle="Apply to teach on Tutor Matcher." />
        <p role="alert" className="text-red-600 dark:text-red-400">
          We could not load your Tutor application. Please refresh and try again.
        </p>
      </main>
    );
  }

  if (phase.name === "pending") {
    const { application } = phase;

    return (
      <main className={pageShellClassName}>
        <PageHeading subtitle="Your application has been submitted." />

        <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div>
            <h2 className="text-xl font-semibold">Awaiting approval</h2>
            <p className="mt-1 text-sm text-zinc-500">
              An admin will review your application. You will be notified once there is a decision.
            </p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium text-zinc-500">Tutor bio</dt>
            <dd className="whitespace-pre-wrap">{application.bio}</dd>
            <dt className="font-medium text-zinc-500">Intro video URL</dt>
            <dd className="break-all">{application.introVideoUrl}</dd>
            <dt className="font-medium text-zinc-500">Government ID</dt>
            <dd className="break-all">{application.governmentId}</dd>
            <dt className="font-medium text-zinc-500">Certification document</dt>
            <dd className="break-all">{application.certificationUrl}</dd>
            {application.avatarUrl && (
              <>
                <dt className="font-medium text-zinc-500">Avatar URL</dt>
                <dd className="break-all">{application.avatarUrl}</dd>
              </>
            )}
          </dl>

          <div>
            <button
              type="button"
              onClick={() => {
                prefill(application);
                setMessage(null);
                setFieldErrors({});
                setPhase({ name: "form", application });
              }}
              className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-black/[.12] px-5 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.18] dark:hover:bg-white/[.08]"
            >
              Cancel &amp; re-submit
            </button>
          </div>
        </section>
      </main>
    );
  }

  const wasRejected = phase.application?.status === "REJECTED";

  return (
    <main className={pageShellClassName}>
      <PageHeading subtitle="Add the public details students will see on your profile. Subjects and hourly rates are configured after your application is approved." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
        {wasRejected && (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"
          >
            Your previous application was not approved. Update your details and re-submit.
          </p>
        )}

        <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Public Tutor details</h2>
            <p className="mt-1 text-sm text-zinc-500">Information shown on your Tutor profile.</p>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Avatar URL <span className="font-normal text-zinc-500">(optional)</span>
              <input
                type="url"
                name="avatarUrl"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                aria-invalid={!!fieldErrors.avatarUrl}
                className={inputClassName}
              />
              {fieldErrors.avatarUrl && (
                <span className="text-red-600">{fieldErrors.avatarUrl}</span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tutor bio
              <textarea
                name="tutorBio"
                rows={5}
                maxLength={2000}
                value={tutorBio}
                onChange={(event) => setTutorBio(event.target.value)}
                aria-invalid={!!fieldErrors.tutorBio}
                className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-base outline-none focus:border-foreground aria-[invalid=true]:border-red-500 dark:border-white/[.18]"
              />
              {fieldErrors.tutorBio && <span className="text-red-600">{fieldErrors.tutorBio}</span>}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Intro video URL
              <input
                type="url"
                name="introVideoUrl"
                placeholder="https://example.com/intro-video.mp4"
                value={introVideoUrl}
                onChange={(event) => setIntroVideoUrl(event.target.value)}
                aria-invalid={!!fieldErrors.introVideoUrl}
                className={inputClassName}
              />
              {fieldErrors.introVideoUrl && (
                <span className="text-red-600">{fieldErrors.introVideoUrl}</span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Government ID
              <input
                name="governmentId"
                maxLength={255}
                value={governmentId}
                onChange={(event) => setGovernmentId(event.target.value)}
                aria-invalid={!!fieldErrors.governmentId}
                className={inputClassName}
              />
              <span className="font-normal text-zinc-500">
                Used for Tutor verification and not displayed publicly.
              </span>
              {fieldErrors.governmentId && (
                <span className="text-red-600">{fieldErrors.governmentId}</span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Teaching certification document URL
              <input
                type="url"
                name="certificationUrl"
                placeholder="https://example.com/certification.pdf"
                value={certificationUrl}
                onChange={(event) => setCertificationUrl(event.target.value)}
                aria-invalid={!!fieldErrors.certificationUrl}
                className={inputClassName}
              />
              <span className="font-normal text-zinc-500">
                Used for Tutor verification and not displayed publicly.
              </span>
              {fieldErrors.certificationUrl && (
                <span className="text-red-600">{fieldErrors.certificationUrl}</span>
              )}
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Consent to data processing</h2>
            <p id="tutor-consent-summary" className="mt-1 text-sm text-zinc-500">
              Your government ID, teaching credentials, and payout details will be processed as
              described below.
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name="consentAccepted"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              aria-invalid={!!fieldErrors.consentAccepted}
              aria-describedby="tutor-consent-summary tutor-consent-description"
              className="mt-0.5 h-4 w-4 rounded border-black/[.25] dark:border-white/[.3]"
            />
            <span id="tutor-consent-description">
              I consent to this processing, as described in the{" "}
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
          {fieldErrors.consentAccepted && (
            <p className="mt-2 text-sm text-red-600">{fieldErrors.consentAccepted}</p>
          )}
        </section>

        {message && (
          <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
            {message}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/dashboard"
            className="flex h-12 items-center justify-center rounded-full border border-black/[.12] px-6 text-base font-medium hover:bg-black/[.04] dark:border-white/[.18] dark:hover:bg-white/[.08]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 cursor-pointer items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        </div>
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
            aria-labelledby="tutor-policy-dialog-title"
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-black/[.12] bg-background p-6 text-left shadow-xl dark:border-white/[.18]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="tutor-policy-dialog-title" className="text-xl font-semibold tracking-tight">
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
    </main>
  );
}

export default function EnrollTutorPage() {
  return (
    <RequireAuth>
      <EnrollTutorForm />
    </RequireAuth>
  );
}
