import Link from "next/link";
import { VerifiedIcon } from "@/src/components/verified-icon";
import type { SubjectSearchResult } from "@/src/lib/discovery-api";

const availabilityFormat = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

export function SubjectCard({ subject }: { subject: SubjectSearchResult }) {
  const tutorName = `${subject.tutor.firstName} ${subject.tutor.lastName}`;
  return (
    <Link
      href={`/tutors/${subject.tutor.id}`}
      aria-label={`${subject.name} with ${tutorName}`}
      className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-navy sm:p-5"
    >
      <h2 className="break-words text-lg font-semibold leading-snug">{subject.name}</h2>
      <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-secondary">
        <span className="min-w-0 break-words">{tutorName}</span>
        {subject.tutor.verified && <VerifiedIcon />}
      </div>
      <p className="mt-2 text-sm leading-5 text-muted">
        Online
        {subject.learningAreas.length > 0 &&
          `, ${subject.learningAreas.map((area) => area.name).join(", ")}`}
      </p>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-secondary">
        {subject.description}
      </p>
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
          <span className="font-semibold text-foreground">
            ฿{subject.hourlyRate}
            <span className="font-normal text-muted"> / hr</span>
          </span>
          <span className="text-muted">
            {subject.rating === null ? (
              "New subject"
            ) : (
              <>
                <span className="text-amber-500" aria-hidden="true">
                  ★
                </span>{" "}
                {subject.rating.toFixed(1)} ({subject.reviewCount}{" "}
                {subject.reviewCount === 1 ? "review" : "reviews"})
              </>
            )}
          </span>
        </div>
        <p className="mt-2 min-h-10 text-xs leading-5 text-muted">
          {subject.nextAvailableAt
            ? `Next available ${availabilityFormat.format(new Date(subject.nextAvailableAt))} (Bangkok time)`
            : "No availability in the next 30 days"}
          {subject.classesTaught > 0 &&
            ` · ${subject.classesTaught} ${subject.classesTaught === 1 ? "class" : "classes"} taught`}
        </p>
      </div>
    </Link>
  );
}
