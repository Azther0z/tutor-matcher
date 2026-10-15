"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type SubmitEvent,
} from "react";
import { tutorApi } from "@/src/lib/tutor-application";
import { validateSubject, type SubjectInput, type SubjectOffering } from "@/src/lib/subjects";

const apiPath = "/api/profiles/me/tutor/subjects";
const emptySubject: SubjectInput = { name: "", description: "", hourlyRate: "", format: "ONLINE" };
const button =
  "rounded-full border border-black/[.12] px-5 py-2 text-sm font-medium hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.18] dark:hover:bg-white/[.08]";
const field =
  "mt-1 w-full rounded-lg border border-black/[.15] bg-transparent px-3 py-2 dark:border-white/[.2]";

export function TutorSubjectsManager({
  subjects,
  setSubjects,
  disabled = false,
  onBusyChange,
}: {
  subjects: SubjectOffering[];
  setSubjects: Dispatch<SetStateAction<SubjectOffering[]>>;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [input, setInput] = useState<SubjectInput>(emptySubject);
  const [errors, setErrors] = useState<ReturnType<typeof validateSubject>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing !== null) nameInput.current?.focus();
  }, [editing]);

  function openEditor(subject?: SubjectOffering) {
    setEditing(subject?.id ?? "new");
    setInput(subject ? { ...subject, description: subject.description ?? "" } : emptySubject);
    setErrors({});
    setError(null);
    setMessage(null);
  }

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || disabled || editing === null) return;
    const validation = validateSubject(input);
    setErrors(validation);
    setError(null);
    if (Object.keys(validation).length) return;

    saving.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      const creating = editing === "new";
      const { subject } = await tutorApi<{ subject: SubjectOffering }>(
        creating ? apiPath : `${apiPath}/${editing}`,
        {
          method: creating ? "POST" : "PUT",
          body: JSON.stringify({
            name: input.name.trim(),
            description: input.description.trim(),
            hourlyRate: input.hourlyRate.trim(),
            format: input.format,
          }),
        }
      );
      setSubjects((current) =>
        creating
          ? [...current, subject]
          : current.map((item) => (item.id === subject.id ? subject : item))
      );
      setEditing(null);
      setMessage(creating ? "Subject added." : "Subject updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save the subject. Please try again."
      );
    } finally {
      saving.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  function editor() {
    return (
      <form
        onSubmit={save}
        aria-label={editing === "new" ? "Add subject" : "Edit subject"}
        noValidate
        className="mt-4 space-y-4"
      >
        <fieldset disabled={busy || disabled} className="space-y-4">
          <div>
            <label htmlFor="subject-name" className="font-medium">
              Subject name
            </label>
            <input
              id="subject-name"
              ref={nameInput}
              className={field}
              value={input.name}
              maxLength={100}
              required
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "subject-name-error" : undefined}
              onChange={(event) => setInput({ ...input, name: event.target.value })}
            />
            {errors.name && (
              <p id="subject-name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="subject-description" className="font-medium">
              Subject description
            </label>
            <textarea
              id="subject-description"
              className={field}
              value={input.description}
              maxLength={2000}
              rows={3}
              required
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "subject-description-error" : undefined}
              onChange={(event) => setInput({ ...input, description: event.target.value })}
            />
            {errors.description && (
              <p
                id="subject-description-error"
                className="mt-1 text-sm text-red-600 dark:text-red-400"
              >
                {errors.description}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="subject-rate" className="font-medium">
                Hourly rate (THB)
              </label>
              <input
                id="subject-rate"
                className={field}
                inputMode="decimal"
                value={input.hourlyRate}
                required
                aria-invalid={!!errors.hourlyRate}
                aria-describedby={errors.hourlyRate ? "subject-rate-error" : undefined}
                onChange={(event) => setInput({ ...input, hourlyRate: event.target.value })}
              />
              {errors.hourlyRate && (
                <p id="subject-rate-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.hourlyRate}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="subject-format" className="font-medium">
                Format
              </label>
              <select
                id="subject-format"
                className={field}
                value={input.format}
                onChange={() => setInput({ ...input, format: "ONLINE" })}
              >
                <option value="ONLINE">Online</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={button}
              onClick={() => {
                setEditing(null);
                setError(null);
                setErrors({});
              }}
            >
              Cancel
            </button>
            <button type="submit" className={button}>
              {busy ? "Saving…" : editing === "new" ? "Add subject" : "Save changes"}
            </button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <section
      className="rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]"
      aria-label="Subjects"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Subjects</h2>
        <button
          type="button"
          className={button}
          disabled={disabled || busy || editing !== null}
          onClick={() => openEditor()}
        >
          Add subject
        </button>
      </div>
      <p className="mt-3 text-sm text-zinc-500">
        Subjects are taught online. Changes save immediately; existing bookings keep their agreed
        details.
      </p>
      {subjects.length === 0 && <p className="mt-4">No subjects yet.</p>}
      <ul className="mt-4 divide-y divide-black/[.08] dark:divide-white/[.12]">
        {subjects.map((subject) => (
          <li key={subject.id} className="py-4" aria-label={`Subject: ${subject.name}`}>
            {editing === subject.id ? (
              editor()
            ) : (
              <>
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-semibold break-words">{subject.name}</h3>
                  <span>฿{subject.hourlyRate} / hr · Online</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-600 dark:text-zinc-400">
                  {subject.description}
                </p>
                <button
                  type="button"
                  className={`${button} mt-3`}
                  disabled={disabled || busy || editing !== null}
                  onClick={() => openEditor(subject)}
                >
                  Edit
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" && editor()}
      {message && (
        <p role="status" className="mt-4">
          {message}
        </p>
      )}
    </section>
  );
}
