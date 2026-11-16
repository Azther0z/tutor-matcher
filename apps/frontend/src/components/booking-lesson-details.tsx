import type { Booking } from "@/src/types/booking";
import { dateTime } from "@/src/lib/booking-format";

// The lesson's people, subject, time, goal and meeting link, for both the Student and the Tutor.
export function LessonDetails({ booking, canJoin }: { booking: Booking; canJoin: boolean }) {
  const isTutorView = booking.viewerRole === "TUTOR";
  const startsAt = booking.startedAt ?? booking.availabilities[0]?.startedAt;
  return (
    <>
      <h2 className="text-xl font-semibold">Lesson details</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-zinc-500">{isTutorView ? "Student" : "Tutor"}</dt>
          <dd className="mt-1 font-semibold">
            {isTutorView ? booking.student.name : booking.subject.tutor.name}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500">Subject</dt>
          <dd className="mt-1 font-semibold">{booking.subject.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500">Format</dt>
          <dd className="mt-1 font-semibold">
            {booking.subject.format === "ONLINE" ? "Online" : booking.subject.format}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-zinc-500">Time</dt>
          <dd className="mt-1 font-semibold">
            {startsAt
              ? dateTime.formatRange(new Date(startsAt), new Date(booking.endedAt))
              : "To be confirmed"}
          </dd>
        </div>
        {booking.description && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-zinc-500">Learning goal</dt>
            <dd className="mt-1">{booking.description}</dd>
          </div>
        )}
      </dl>
      {canJoin && booking.effectiveMeetingUrl && (
        <a
          href={booking.effectiveMeetingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-violet-600 px-5 font-semibold text-white"
        >
          Join lesson
        </a>
      )}
      {booking.status === "CONFIRMED" && !booking.effectiveMeetingUrl && (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Your booking is confirmed. A meeting link is not available yet.
        </p>
      )}
      {booking.effectiveMeetingUrl && (
        <p className="mt-3 text-sm text-zinc-500">
          Using {booking.customMeetingUrl ? "the Tutor-provided link" : "the generated link"}.
        </p>
      )}
      {booking.meetingLinkUpdatedAt && (
        <p className="mt-2 text-sm text-zinc-500">
          Meeting link last updated on {dateTime.format(new Date(booking.meetingLinkUpdatedAt))}.
        </p>
      )}
    </>
  );
}
