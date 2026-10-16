import { Suspense } from "react";
import { TutorSearch } from "@/src/components/tutor-search";

// The search reads its filters from the URL, so it renders on the client inside Suspense.
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14 text-zinc-500">
          Loading search…
        </main>
      }
    >
      <TutorSearch />
    </Suspense>
  );
}
