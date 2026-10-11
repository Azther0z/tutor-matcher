"use client";

import { useState } from "react";

export function TutorConsent({
  consentAccepted,
  setConsentAccepted,
  error,
}: {
  consentAccepted: boolean;
  setConsentAccepted: (accepted: boolean) => void;
  error?: string;
}) {
  const [openDocument, setOpenDocument] = useState<"privacy" | "terms" | null>(null);
  const fieldErrors = { consentAccepted: error };
  return (
    <>
      <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Consent to data processing</h2>
          <p id="tutor-consent-summary" className="mt-1 text-sm text-zinc-500">
            Your identification card, teaching credentials, and payout details will be processed as
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
    </>
  );
}
