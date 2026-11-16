import { Suspense } from "react";
import { TutorSearch, TutorSearchLoadingState } from "@/src/components/tutor-search";

// The search reads its filters from the URL, so it renders on the client inside Suspense.
export default function SearchPage() {
  return (
    <Suspense fallback={<TutorSearchLoadingState />}>
      <TutorSearch />
    </Suspense>
  );
}
