import Link from "next/link";
import { TutorProfileSnapshot } from "@/src/components/tutor-profile-comparison";
import { button, panel } from "@/src/lib/tutor-profile-style";
import type { TutorProfileState } from "@/src/lib/use-tutor-profile";

// An applicant who is not yet a Tutor sees their pending application and can cancel it.
export function PendingApplicationPanel({ profile }: { profile: TutorProfileState }) {
  const { pending, busy, cancelAndResubmit } = profile;
  if (!pending) return null;
  return (
    <section className={panel} aria-label="Application status">
      <h2 className="text-xl font-semibold">Awaiting approval</h2>
      <p className="mt-2 text-sm text-zinc-500">
        An admin is reviewing the documents and introduction video you submitted. You can cancel
        this application and re-submit corrected details.
      </p>
      <div className="mt-4">
        <TutorProfileSnapshot profile={pending} />
      </div>
      <button
        className={`${button} mt-4`}
        disabled={busy}
        onClick={() => cancelAndResubmit(pending.id)}
      >
        Cancel and re-submit
      </button>
    </section>
  );
}

// The approved profile: bio, publication switch and, for approved applicants, where to go next.
export function ApprovedProfilePanel({
  profile,
  enrollment,
}: {
  profile: TutorProfileState;
  enrollment: boolean;
}) {
  const { tutor, busy, approvedEnrollment, togglePublication } = profile;
  if (!tutor) return null;
  return (
    <section className={panel} aria-label="Current approved profile">
      <h2 className="text-xl font-semibold">
        Current approved profile{" "}
        {tutor.verified && (
          <span className="ml-2 rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-700 dark:text-green-300">
            Verified
          </span>
        )}
      </h2>
      <p className="mt-3 whitespace-pre-wrap">{tutor.bio}</p>
      <p className="mt-3 text-sm">
        Publication: <strong>{tutor.status === "PUBLISHED" ? "Published" : "Unpublished"}</strong>
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Unpublishing stops discovery and new bookings. Existing chats and booked lessons remain
        accessible.
      </p>
      <button
        className={`${button} mt-4`}
        disabled={busy}
        onClick={() => togglePublication(tutor.status !== "PUBLISHED")}
      >
        {tutor.status === "PUBLISHED" ? "Unpublish profile" : "Publish profile"}
      </button>
      {!enrollment && (
        <div className="mt-5">
          <h3 className="font-semibold">Verification</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Your identity has been verified. Document changes use the profile review process below.
          </p>
        </div>
      )}
      {approvedEnrollment && (
        <p className="mt-4">
          Your application is approved.{" "}
          <Link href="/settings/tutor" className="underline">
            Manage your Tutor profile
          </Link>{" "}
          or{" "}
          <Link href="/dashboard?tab=tutor" className="underline">
            open your Tutor dashboard
          </Link>
          .
        </p>
      )}
    </section>
  );
}

// The outcome of the latest review: approved, or rejected with its reason.
export function ReviewOutcome({ profile }: { profile: TutorProfileState }) {
  const { latestReview, tutor, busy, approvedEnrollment, copySubmissionToDraft } = profile;
  if (latestReview?.status === "APPROVED")
    return (
      <p role="status">
        Your profile was approved.
        {tutor
          ? " The approved changes have been applied automatically."
          : " Refresh to see your Tutor profile."}
      </p>
    );
  if (latestReview?.status !== "REJECTED") return null;
  return (
    <section className={panel} role="status">
      <h2 className="text-xl font-semibold">Request rejected</h2>
      <p className="mt-2">Reason: {latestReview.rejectionReason}</p>
      <p className="mt-2">
        {tutor ? "Your approved profile is unchanged. " : ""}You can revise this request in a new
        draft and re-submit it.
      </p>
      {!approvedEnrollment && (
        <button
          className={`${button} mt-4`}
          disabled={busy}
          onClick={() =>
            copySubmissionToDraft(
              latestReview.id,
              "New draft created from the rejected request. Update it and submit again."
            )
          }
        >
          Revise and re-submit
        </button>
      )}
    </section>
  );
}
