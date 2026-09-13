"use client";

import Link from "next/link";
import { useState } from "react";
import {
  TutorDetailsFields,
  tutorDetailsInputClassName,
} from "@/src/components/tutor-details-fields";
import {
  type TutorDetails,
  type TutorDetailsFieldErrors,
  validateTutorDetails,
} from "@/src/lib/tutor-details";

type FieldErrors = Partial<Record<"firstName" | "lastName", string>> & TutorDetailsFieldErrors;

export default function TutorSettingsPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userBio, setUserBio] = useState("");
  const [details, setDetails] = useState<TutorDetails>({
    avatarUrl: "",
    bio: "",
    introVideoUrl: "",
    identificationCardUrl: "",
    certificationUrl: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errors: FieldErrors = validateTutorDetails(details);

    if (!firstName.trim()) errors.firstName = "First name is required.";
    if (!lastName.trim()) errors.lastName = "Last name is required.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!validate()) {
      setMessage("Complete the highlighted fields before saving your profile.");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      setMessage("Please log in before saving your Tutor profile.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/profiles/me", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            bio: userBio.trim() || null,
          },
          tutor: {
            avatarUrl: details.avatarUrl.trim() || null,
            bio: details.bio.trim(),
            introVideoUrl: details.introVideoUrl.trim(),
            identificationCardUrl: details.identificationCardUrl.trim(),
            certificationUrl: details.certificationUrl.trim(),
          },
        }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setMessage(data?.message ?? "Could not save your Tutor profile.");
        return;
      }

      setFieldErrors({});
      setMessage("Tutor profile saved successfully.");
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-4xl font-semibold tracking-tight">Build your Tutor profile</h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Add the details students need to understand your experience. Subjects and hourly rates
          will be configured separately.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
        <section className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Personal details</h2>
            <p className="mt-1 text-sm text-zinc-500">Information connected to your account.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              First name
              <input
                name="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                aria-invalid={!!fieldErrors.firstName}
                className={tutorDetailsInputClassName}
              />
              {fieldErrors.firstName && (
                <span className="text-red-600">{fieldErrors.firstName}</span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Last name
              <input
                name="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                aria-invalid={!!fieldErrors.lastName}
                className={tutorDetailsInputClassName}
              />
              {fieldErrors.lastName && <span className="text-red-600">{fieldErrors.lastName}</span>}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
              Personal bio <span className="font-normal text-zinc-500">(optional)</span>
              <textarea
                name="userBio"
                rows={3}
                maxLength={2000}
                value={userBio}
                onChange={(event) => setUserBio(event.target.value)}
                className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-base outline-none focus:border-foreground dark:border-white/[.18]"
              />
            </label>
          </div>
        </section>

        <TutorDetailsFields
          values={details}
          errors={fieldErrors}
          onChange={(name, value) => setDetails((current) => ({ ...current, [name]: value }))}
        />

        {message && (
          <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
            {message}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/dashboard/tutor"
            className="flex h-12 items-center justify-center rounded-full border border-black/[.12] px-6 text-base font-medium hover:bg-black/[.04] dark:border-white/[.18] dark:hover:bg-white/[.08]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {submitting ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </main>
  );
}
