"use client";

import { useState } from "react";
import { TutorDialog } from "@/src/components/tutor-dialog";

export function TutorConsent({
  consentAccepted,
  setConsentAccepted,
  error,
  unframed = false,
}: {
  consentAccepted: boolean;
  setConsentAccepted: (accepted: boolean) => void;
  error?: string;
  unframed?: boolean;
}) {
  const [openDocument, setOpenDocument] = useState<"privacy" | "terms" | null>(null);
  const fieldErrors = { consentAccepted: error };
  return (
    <>
      <section
        className={
          unframed ? undefined : "rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]"
        }
      >
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Consent to data processing</h2>
          <p id="tutor-consent-summary" className="mt-1 text-sm text-zinc-500">
            Your identification card is visible only to you and administrators. Approved portfolio
            links are visible to students. Your data will be processed as described below.
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
        <TutorDialog
          title={openDocument === "privacy" ? "Privacy Policy" : "Terms of Service"}
          titleId="tutor-policy-dialog-title"
          onClose={() => setOpenDocument(null)}
        >
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
                By using Tutor Matcher, you agree to provide accurate information, keep your account
                secure, and use the service lawfully and respectfully.
              </p>
              <p>
                Tutor Matcher helps students and tutors discover and communicate with one another.
                We do not guarantee a particular match, lesson outcome, availability, or service
                quality, and users should exercise appropriate judgment when arranging lessons.
              </p>
              <p>
                We may suspend or close accounts that misuse the platform, violate these terms, or
                create a safety or security risk. These terms may be updated as the service changes;
                continued use after an update means you accept the revised terms.
              </p>
            </div>
          )}
        </TutorDialog>
      )}
    </>
  );
}
