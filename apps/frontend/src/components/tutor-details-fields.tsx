"use client";

import type { ReactNode } from "react";
import type {
  TutorDetails,
  TutorDetailsFieldErrors,
  TutorDetailsFieldName,
} from "@/src/lib/tutor-details";

export const tutorDetailsInputClassName =
  "h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground aria-[invalid=true]:border-red-500 dark:border-white/[.18]";

const tutorDetailsTextAreaClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-base outline-none focus:border-foreground aria-[invalid=true]:border-red-500 dark:border-white/[.18]";

type TutorFieldProps = {
  name: TutorDetailsFieldName;
  label: string;
  value: string;
  onChange: (name: TutorDetailsFieldName, value: string) => void;
  error?: string;
  optional?: boolean;
  type?: "text" | "url";
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  helper?: ReactNode;
};

function TutorField({
  name,
  label,
  value,
  onChange,
  error,
  optional = false,
  type = "text",
  placeholder,
  maxLength,
  rows,
  helper,
}: TutorFieldProps) {
  const helperId = `${name}-description`;
  const errorId = `${name}-error`;
  const describedBy = [helper && helperId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label htmlFor={name} className="flex flex-col gap-1.5 text-sm font-medium">
      <span>
        {label} {optional && <span className="font-normal text-zinc-500">(optional)</span>}
      </span>
      {rows ? (
        <textarea
          id={name}
          name={name}
          rows={rows}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={tutorDetailsTextAreaClassName}
        />
      ) : (
        <input
          id={name}
          type={type}
          name={name}
          placeholder={placeholder}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={tutorDetailsInputClassName}
        />
      )}
      {helper && (
        <span id={helperId} className="font-normal text-zinc-500">
          {helper}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

type TutorDetailsFieldsProps = {
  values: TutorDetails;
  errors: TutorDetailsFieldErrors;
  onChange: (name: TutorDetailsFieldName, value: string) => void;
  onCertificationsChange: (urls: string[]) => void;
  title?: string;
  description?: string;
  unframed?: boolean;
};

export function TutorDetailsFields({
  values,
  errors,
  onChange,
  onCertificationsChange,
  unframed = false,
  title = "Public Tutor details",
  description = "Information shown on your Tutor profile.",
}: TutorDetailsFieldsProps) {
  return (
    <section
      className={
        unframed ? undefined : "rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]"
      }
    >
      {!unframed && (
        <div className="mb-5">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <TutorField
          name="avatarUrl"
          label="Avatar URL"
          value={values.avatarUrl}
          onChange={onChange}
          error={errors.avatarUrl}
          optional
          type="url"
          placeholder="https://example.com/avatar.jpg"
        />
        <TutorField
          name="bio"
          label="Tutor bio"
          value={values.bio}
          onChange={onChange}
          error={errors.bio}
          rows={5}
          maxLength={2000}
        />
        <TutorField
          name="introVideoUrl"
          label="Intro video URL"
          value={values.introVideoUrl}
          onChange={onChange}
          error={errors.introVideoUrl}
          type="url"
          placeholder="https://example.com/intro-video.mp4"
        />
        <TutorField
          name="identificationCardUrl"
          label="Identification card URL"
          value={values.identificationCardUrl}
          onChange={onChange}
          error={errors.identificationCardUrl}
          type="url"
          placeholder="https://example.com/identification-card.pdf"
          maxLength={255}
          helper="Used for Tutor verification. Visible only to you and administrators."
        />
        <section aria-label="Teaching certifications / portfolio" className="flex flex-col gap-3">
          <h3 className="font-medium">Teaching certifications / portfolio (optional)</h3>
          <p className="text-sm text-zinc-500">
            Optional portfolio evidence, such as contest certificates. Students can view these links
            on your profile after approval. Blank entries are omitted.
          </p>
          {values.certificationUrls.map((url, index) => {
            const error = errors.certifications?.[index];
            return (
              <div key={index} className="flex items-start gap-3">
                <div className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
                  <label htmlFor={`certification-${index}`}>
                    Certification / portfolio URL {index + 1}
                  </label>
                  <input
                    id={`certification-${index}`}
                    type="url"
                    value={url}
                    placeholder="https://example.com/certification.pdf"
                    aria-invalid={!!error}
                    aria-describedby={error ? `certification-error-${index}` : undefined}
                    className={tutorDetailsInputClassName}
                    onChange={(event) =>
                      onCertificationsChange(
                        values.certificationUrls.map((current, i) =>
                          i === index ? event.target.value : current
                        )
                      )
                    }
                  />
                  {error && (
                    <span
                      id={`certification-error-${index}`}
                      className="text-red-600 dark:text-red-400"
                    >
                      {error}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="mt-6 rounded-lg border px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.08]"
                  onClick={() =>
                    onCertificationsChange(values.certificationUrls.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove certification ${index + 1}`}
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
              </div>
            );
          })}
          <button
            type="button"
            className="self-start rounded-lg border px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.08]"
            onClick={() => onCertificationsChange([...values.certificationUrls, ""])}
          >
            Add certification
          </button>
        </section>
      </div>
    </section>
  );
}
