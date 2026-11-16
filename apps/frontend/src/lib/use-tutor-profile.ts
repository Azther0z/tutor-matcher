import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SubjectOffering } from "@/src/lib/subjects";
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

export const apiPath = "/api/profiles/me/tutor";
export const incompleteDraftMessage = "Complete this draft before submitting for review.";

// The fields a reviewer compares; two profiles with the same content need no new review.
export function profileContent(profile: TutorProfileFields) {
  const fields = tutorDetailsPayload(tutorDetailsFromApplication(profile));
  return JSON.stringify([
    fields.avatarUrl,
    fields.bio,
    fields.introVideoUrl,
    fields.identificationCardUrl,
  ]);
}

// Everything the Tutor profile page keeps in state: the loaded application, the open draft,
// which dialog is showing, and the actions that change them.
export function useTutorProfile(enrollment: boolean) {
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
  const [profileBusy, setBusy] = useState(false);
  const [subjectBusy, setSubjectBusy] = useState(false);
  const busy = profileBusy || subjectBusy;
  const [subjects, setSubjects] = useState<SubjectOffering[]>([]);
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
        // An approved Tutor has no application to manage. Only the initial load redirects, so a
        // pending applicant who refreshes into approval still sees the approved result here.
        if (enrollment && result.tutor && reload === 0) {
          replace("/dashboard?tab=tutor");
        }
        setData(result);
        setSubjects(result.tutor?.subjects ?? []);
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
    if (Object.keys(nextErrors).length) {
      setActionError(incompleteDraftMessage);
      return;
    }
    if (noChanges || pending) return;
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

  // Copies a cancelled or rejected submission into a new saved draft and opens it for revision.
  function copySubmissionToDraft(submissionId: string, copiedMessage: string) {
    requestTransition(() => {
      void runAction(async () => {
        const result = await tutorApi<TutorApplicationResponse>(
          `${apiPath}/submissions/${submissionId}/copy`,
          { method: "POST" }
        );
        setData(result);
        loadDetails(tutorDetailsFromApplication(result.version), result.version!.id);
        setEditorOpen(true);
        setMessage(copiedMessage);
      });
    });
  }

  function cancelAndResubmit(submissionId: string) {
    requestTransition(() => {
      void runAction(async () => {
        await tutorApi<TutorApplicationResponse>(`${apiPath}/withdraw`, { method: "POST" });
        const result = await tutorApi<TutorApplicationResponse>(
          `${apiPath}/submissions/${submissionId}/copy`,
          { method: "POST" }
        );
        setData(result);
        loadDetails(tutorDetailsFromApplication(result.version), result.version!.id);
        setEditorOpen(true);
        setMessage(
          "Application cancelled. Edit the new draft copied from it, then submit it again."
        );
      });
    });
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

  // The Tutor taps a saved draft's Submit: open it for fixing, or go straight to consent.
  function submitSavedDraft(draft: TutorProfileVersion) {
    requestTransition(() => {
      const next = tutorDetailsFromApplication(draft);
      loadDetails(next, draft.id);
      const nextErrors = validateTutorDetails(next);
      setErrors(nextErrors);
      setActionError(null);
      setMessage(null);
      if (Object.keys(nextErrors).length) {
        setEditorOpen(true);
        setActionError(incompleteDraftMessage);
      } else {
        setRowSubmission(true);
        setSubmitOpen(true);
      }
    });
  }

  function editSavedDraft(draft: TutorProfileVersion) {
    requestTransition(() => {
      loadDetails(tutorDetailsFromApplication(draft), draft.id);
      setMessage(null);
      setActionError(null);
      setEditorOpen(true);
    });
  }

  function startNewDraft() {
    requestTransition(() => {
      loadDetails(emptyTutorDetails, null);
      setMessage(null);
      setActionError(null);
      setEditorOpen(true);
    });
  }

  function discardSavedDraft(draftId: string) {
    void runAction(async () => {
      const result = await tutorApi<TutorApplicationResponse>(`${apiPath}/drafts/${draftId}`, {
        method: "DELETE",
      });
      setData(result);
      if (selectedId === draftId) loadDetails(emptyTutorDetails, null);
      setMessage("Draft discarded.");
    });
  }

  function togglePublication(published: boolean) {
    void runAction(async () => {
      const result = await tutorApi<TutorApplicationResponse>(`${apiPath}/publication`, {
        method: "PATCH",
        body: JSON.stringify({ published }),
      });
      setData(result);
      setMessage(
        result.tutor?.status === "PUBLISHED"
          ? "Your profile is now published."
          : "Your profile is now unpublished."
      );
    });
  }

  function withdrawPending() {
    void runAction(async () => {
      const result = await tutorApi<TutorApplicationResponse>(`${apiPath}/withdraw`, {
        method: "POST",
      });
      setData(result);
      if (!dirty && !selectedId) loadDetails(emptyTutorDetails, null);
      setConsent(false);
      setMessage("Request cancelled. You can create a new draft from its submission history.");
    });
  }

  function refreshStatus() {
    requestTransition(() => {
      setEditorOpen(false);
      setData(null);
      setMessage(null);
      setActionError(null);
      setConsent(false);
      setErrors({});
      setReload((value) => value + 1);
    });
  }

  function saveAndMessage() {
    void runAction(async () => {
      await saveDraft();
      setMessage("Draft saved. It has not been submitted for review.");
    });
  }

  function saveThenLeave() {
    void runAction(async () => {
      await saveDraft();
      const transition = closeTransition;
      setCloseTransition(null);
      transition?.();
      setMessage("Draft saved. It has not been submitted for review.");
    });
  }

  function discardThenLeave() {
    loadDetails(emptyTutorDetails, null);
    const transition = closeTransition;
    setCloseTransition(null);
    transition?.();
  }

  function retryLoad() {
    setLoadError(null);
    setReload((value) => value + 1);
  }

  const tutor = data?.tutor;
  const pending = data?.pendingRequest;
  const latestReview = data?.latestReview;
  const approvedEnrollment = enrollment && !!tutor;
  const noChanges =
    !!tutor && profileContent(tutorDetailsPayload(details)) === profileContent(tutor);
  // Missing fields leave Submit enabled: pressing it highlights them instead.
  const canSubmit = !noChanges && !pending;

  return {
    replace,
    data,
    details,
    errors,
    consent,
    setConsent,
    editorOpen,
    submitOpen,
    closeTransition,
    setCloseTransition,
    selectedId,
    dirty,
    loadError,
    message,
    actionError,
    profileBusy,
    setSubjectBusy,
    busy,
    subjects,
    setSubjects,
    tutor,
    pending,
    latestReview,
    approvedEnrollment,
    noChanges,
    canSubmit,
    requestTransition,
    closeEditor,
    updateDetails,
    submit,
    editSubmission,
    cancelSubmission,
    copySubmissionToDraft,
    cancelAndResubmit,
    confirmSubmit,
    submitSavedDraft,
    editSavedDraft,
    startNewDraft,
    discardSavedDraft,
    togglePublication,
    withdrawPending,
    refreshStatus,
    saveAndMessage,
    saveThenLeave,
    discardThenLeave,
    retryLoad,
  };
}

export type TutorProfileState = ReturnType<typeof useTutorProfile>;
