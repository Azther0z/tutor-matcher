import Link from "next/link";
import { RequireAuth } from "@/src/components/require-auth";
import { TutorAvailabilityEditor } from "@/src/components/tutor-availability-editor";

export default function TutorDashboardPage() {
  return (
    <RequireAuth>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Tutor dashboard</h1>
          <Link
            href="/settings/tutor"
            className="text-sm font-semibold text-violet-700 underline dark:text-violet-300"
          >
            Manage subjects and listing
          </Link>
        </div>
        <TutorAvailabilityEditor />
      </main>
    </RequireAuth>
  );
}
