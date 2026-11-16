import { button, panel } from "@/src/lib/tutor-profile-style";
import { profileContent, type TutorProfileState } from "@/src/lib/use-tutor-profile";

// The Tutor's saved drafts: edit, discard or submit one, or start a new draft.
export function SavedDrafts({ profile }: { profile: TutorProfileState }) {
  const { data, tutor, pending, busy, editSavedDraft, discardSavedDraft, submitSavedDraft } =
    profile;
  return (
    <section className={panel} aria-label="Saved drafts">
      <h2 className="text-xl font-semibold">Your drafts</h2>
      <p className="my-3 text-sm text-zinc-500">
        Select one saved snapshot to edit. Pending requests and reviewed versions cannot be edited.
      </p>
      {!data?.drafts.length ? (
        <p>No saved drafts yet.</p>
      ) : (
        <ul className="divide-y divide-black/[.08] dark:divide-white/[.12]">
          {data.drafts.map((draft, index) => {
            const unchanged = !!tutor && profileContent(draft) === profileContent(tutor);
            const label = `draft ${index + 1}: ${draft.bio?.trim().slice(0, 100) || "Untitled draft"}`;
            return (
              <li
                key={draft.id}
                className="flex items-center justify-between gap-4 rounded-md py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {draft.bio?.trim().slice(0, 100) || "Untitled draft"}
                  </p>
                  <time className="text-sm text-zinc-500" dateTime={draft.createdAt}>
                    {new Date(draft.createdAt).toLocaleString()}
                  </time>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    aria-label={`Edit ${label}`}
                    aria-haspopup="dialog"
                    className="rounded-md border border-black/[.12] px-3 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.18] dark:hover:bg-white/[.08]"
                    disabled={busy}
                    onClick={() => editSavedDraft(draft)}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
                      <path d="m14 5 5 5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={`Trash ${label}`}
                    className="rounded-md border border-black/[.12] px-3 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:border-white/[.18] dark:text-red-300"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Permanently discard ${label}? This cannot be undone.`))
                        return;
                      discardSavedDraft(draft.id);
                    }}
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
                  <button
                    type="button"
                    aria-label={`Submit ${label}`}
                    aria-haspopup="dialog"
                    disabled={busy || !!pending || unchanged}
                    title={
                      pending
                        ? "Only one request can be pending. Withdraw it before submitting another."
                        : unchanged
                          ? "Change your profile before submitting for review."
                          : "Submit this draft for review"
                    }
                    className="rounded-md border border-black/[.12] px-3 py-2 text-sm hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.18] dark:hover:bg-white/[.08]"
                    onClick={() => submitSavedDraft(draft)}
                  >
                    Submit
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className={`${button} mt-4`}
        disabled={busy}
        onClick={profile.startNewDraft}
        aria-haspopup="dialog"
        data-tutor-dialog-trigger
      >
        New draft
      </button>
    </section>
  );
}
