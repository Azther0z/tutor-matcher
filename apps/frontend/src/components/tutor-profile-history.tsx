import Link from "next/link";
import { TutorProfileSnapshot } from "@/src/components/tutor-profile-comparison";
import { TutorRefreshButton } from "@/src/components/tutor-refresh-button";
import { TutorSubmissionStatus } from "@/src/components/tutor-submission-status";
import { button, panel } from "@/src/lib/tutor-profile-style";
import type { TutorProfileState } from "@/src/lib/use-tutor-profile";

// Every request the Tutor has submitted, with withdraw and copy-to-draft actions.
export function SubmissionHistory({ profile }: { profile: TutorProfileState }) {
  const { data, tutor, busy, approvedEnrollment, refreshStatus, withdrawPending } = profile;
  return (
    <section className={panel} aria-label="Submission history">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Submission history</h2>
        <TutorRefreshButton label="Refresh review status" disabled={busy} onClick={refreshStatus} />
      </div>
      {data?.submissions?.length ? (
        <ul className="mt-4 divide-y divide-line ">
          {data.submissions.map((submission) => (
            <li key={submission.id} className="py-3">
              <details>
                <summary className="cursor-pointer font-medium">
                  <TutorSubmissionStatus status={submission.status} plain />
                  {submission.submittedAt &&
                    ` · Submitted ${new Date(submission.submittedAt).toLocaleString()}`}
                </summary>
                <div className="mt-4">
                  {submission.status === "PENDING" && (
                    <p className="mb-4 text-sm text-muted">
                      {tutor
                        ? "Your current approved profile stays unchanged while these edits are reviewed. You can keep teaching and change publication independently."
                        : "Your application is awaiting admin approval. You remain a student until it is approved."}{" "}
                      Submitted requests cannot be edited. Withdrawing cancels the request; you can
                      then create a separate draft from its history.
                    </p>
                  )}
                  <TutorProfileSnapshot profile={submission} />
                  {submission.status === "PENDING" && (
                    <button className={`${button} mt-4`} disabled={busy} onClick={withdrawPending}>
                      Withdraw request
                    </button>
                  )}
                  {submission.reviewedAt && (
                    <p className="mt-3 text-sm">
                      Reviewed {new Date(submission.reviewedAt).toLocaleString()}
                    </p>
                  )}
                  {submission.rejectionReason && (
                    <p className="mt-3">Reason: {submission.rejectionReason}</p>
                  )}
                  {(submission.status === "CANCELLED" || submission.status === "REJECTED") &&
                    (approvedEnrollment ? (
                      <Link href="/settings/tutor" className="mt-4 inline-block underline">
                        Create a draft in Tutor settings
                      </Link>
                    ) : (
                      <button
                        className={`${button} mt-4`}
                        disabled={busy}
                        onClick={() =>
                          profile.copySubmissionToDraft(
                            submission.id,
                            `New draft created from the ${submission.status.toLowerCase()} submission.`
                          )
                        }
                      >
                        Create draft from {submission.status.toLowerCase()} submission
                      </button>
                    ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No submissions yet.</p>
      )}
    </section>
  );
}
