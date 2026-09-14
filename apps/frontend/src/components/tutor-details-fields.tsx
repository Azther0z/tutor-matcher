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
  title?: string;
  description?: string;
};

export function TutorDetailsFields({
  values,
  errors,
  onChange,
  title = "Public Tutor details",
  description = "Information shown on your Tutor profile.",
}: TutorDetailsFieldsProps) {
  return (
    <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

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
          helper="Used for Tutor verification and not displayed publicly."
        />
        <TutorField
          name="certificationUrl"
          label="Teaching certification document URL"
          value={values.certificationUrl}
          onChange={onChange}
          error={errors.certificationUrl}
          type="url"
          placeholder="https://example.com/certification.pdf"
          helper="Used for Tutor verification and not displayed publicly."
        />
      </div>
    </section>
  );
}
