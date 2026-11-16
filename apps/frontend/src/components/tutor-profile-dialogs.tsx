import { TutorConsent } from "@/src/components/tutor-consent";
import { TutorDetailsFields } from "@/src/components/tutor-details-fields";
import { TutorDialog } from "@/src/components/tutor-dialog";
import { button, primaryButton } from "@/src/lib/tutor-profile-style";
import type { TutorProfileState } from "@/src/lib/use-tutor-profile";

// The draft form, opened from the drafts list or "New draft".
export function DraftDialog({ profile }: { profile: TutorProfileState }) {
  const {
    busy,
    selectedId,
    dirty,
    pending,
    noChanges,
    canSubmit,
    details,
    errors,
    actionError,
    message,
    closeTransition,
    submitOpen,
    closeEditor,
    saveAndMessage,
    submit,
    updateDetails,
  } = profile;
  return (
    <TutorDialog
      title="Draft"
      status={selectedId && !dirty ? "Saved" : "Not saved"}
      titleId="tutor-draft-dialog-title"
      busy={busy}
      onClose={closeEditor}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={button} disabled={busy} onClick={saveAndMessage}>
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
            One request is already pending. You can create, edit, save, and discard drafts while it
            is reviewed.
          </p>
        )}
        {noChanges && (
          <p className="text-sm text-muted">
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
  );
}

// Shown when the Tutor leaves an unsaved draft: save it, discard the edits, or keep editing.
export function UnsavedChangesDialog({ profile }: { profile: TutorProfileState }) {
  const { busy, actionError, setCloseTransition, discardThenLeave, saveThenLeave } = profile;
  return (
    <TutorDialog
      title="Unsaved changes"
      titleId="tutor-close-title"
      busy={busy}
      onClose={() => setCloseTransition(null)}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={button} disabled={busy} onClick={discardThenLeave}>
            Discard
          </button>
          <button type="button" className={primaryButton} disabled={busy} onClick={saveThenLeave}>
            Save
          </button>
        </div>
      }
    >
      <p>
        Save your changes before closing? Discard drops only unsaved edits; your saved draft stays
        in the list. Closing with × returns to editing.
      </p>
      {actionError && (
        <p role="alert" className="mt-4 text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}
    </TutorDialog>
  );
}

// The last step: the Tutor accepts the consent text and sends the draft for review.
export function SubmitDraftDialog({ profile }: { profile: TutorProfileState }) {
  const {
    busy,
    consent,
    setConsent,
    pending,
    actionError,
    cancelSubmission,
    editSubmission,
    confirmSubmit,
  } = profile;
  return (
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
  );
}
