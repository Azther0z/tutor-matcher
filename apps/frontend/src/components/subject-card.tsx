import Link from "next/link";
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
      className="flex h-full flex-col gap-3 rounded-3xl border border-black/10 p-5 transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-lg dark:border-white/15"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {subject.tutor.firstName.charAt(0).toUpperCase()}
          {subject.tutor.lastName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{subject.name}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="truncate">{tutorName}</span>
            {subject.tutor.verified && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Verified
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        {subject.rating === null ? (
          "New subject"
        ) : (
          <>
            <span className="font-semibold text-foreground">★ {subject.rating.toFixed(1)}</span> (
            {subject.reviewCount} {subject.reviewCount === 1 ? "review" : "reviews"})
          </>
        )}
        {subject.classesTaught > 0 &&
          ` · ${subject.classesTaught} ${subject.classesTaught === 1 ? "class" : "classes"} taught`}
      </p>
      <p className="text-sm text-zinc-500">
        {subject.nextAvailableAt
          ? `Next available ${availabilityFormat.format(new Date(subject.nextAvailableAt))} (Bangkok time)`
          : "No availability in the next 30 days"}
      </p>
      {subject.description && (
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
          {subject.description}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {subject.learningAreas.map((area) => (
          <span
            key={area.id}
            className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800"
          >
            {area.name}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 text-sm">
        <span className="text-zinc-500">Online</span>
        <span className="shrink-0">
          <span className="text-lg font-bold">฿{subject.hourlyRate}</span>
          <span className="text-zinc-500"> / hr</span>
        </span>
      </div>
    </Link>
  );
}
