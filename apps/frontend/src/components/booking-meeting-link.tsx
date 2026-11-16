"use client";

import { useState } from "react";
import { BookingApiError, updateMeetingLink } from "@/src/lib/bookings-api";
import type { BookingPanelContext } from "@/src/lib/use-booking-detail";

const MAX_MEETING_URL_LENGTH = 2048;

function meetingUrlValidationMessage(value: string) {
  if (value.length > MAX_MEETING_URL_LENGTH) {
    return `Meeting links must be ${MAX_MEETING_URL_LENGTH} characters or fewer.`;
  }

  try {
    if (new URL(value).protocol === "https:") return null;
  } catch {
    // The URL constructor rejects relative, malformed, and incomplete URLs.
  }

  return "Enter a valid HTTPS meeting link.";
}

// BOOK-8: the Tutor adds, replaces or removes their own meeting link until the lesson ends.
export function MeetingLinkEditor({ context }: { context: BookingPanelContext }) {
  const { booking, setBooking, setMessage, reload } = context;
  const [draft, setDraft] = useState(booking.customMeetingUrl ?? "");
  const [seen, setSeen] = useState(booking);
  const [saving, setSaving] = useState(false);
  // A reloaded or updated booking replaces whatever was typed, as the saved link is the truth.
  if (seen !== booking) {
    setSeen(booking);
    setDraft(booking.customMeetingUrl ?? "");
  }

  async function save(customMeetingUrl: string | null) {
    if (!booking.actions.canEditMeetingLink || saving) return;
    if (customMeetingUrl !== null) {
      const validationMessage = meetingUrlValidationMessage(customMeetingUrl);
      if (validationMessage) {
        setMessage(validationMessage);
        return;
      }
    }

    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateMeetingLink(booking.id, customMeetingUrl);
      setBooking(updated);
      setMessage(
        customMeetingUrl === null
          ? updated.zoomMeetingUrl
            ? "Tutor link removed. The generated meeting link is restored."
            : "Tutor link removed. No meeting link is available yet."
          : "Meeting link updated."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the meeting link.");
      if (
        error instanceof BookingApiError &&
        (error.status === 403 ||
          error.status === 404 ||
          (error.status === 409 && error.code === "MEETING_LINK_NOT_EDITABLE"))
      ) {
        await reload();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <label htmlFor="custom-meeting-url" className="block text-sm font-semibold">
        {booking.customMeetingUrl ? "Replace meeting link" : "Add meeting link"}
      </label>
      <p className="mt-1 text-sm text-zinc-500">
        Enter an HTTPS meeting link. The link is not checked with the provider.
      </p>
      <input
        id="custom-meeting-url"
        type="url"
        inputMode="url"
        autoComplete="url"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="https://..."
        className="mt-3 min-h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving || !draft.trim() || draft.trim() === booking.customMeetingUrl}
          onClick={() => void save(draft.trim())}
          className="inline-flex min-h-10 items-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save link"}
        </button>
        {booking.customMeetingUrl && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(null)}
            className="inline-flex min-h-10 items-center rounded-full border border-zinc-300 px-4 text-sm font-semibold disabled:opacity-50 dark:border-zinc-700"
          >
            {booking.zoomMeetingUrl ? "Restore generated link" : "Remove Tutor link"}
          </button>
        )}
      </div>
    </div>
  );
}
