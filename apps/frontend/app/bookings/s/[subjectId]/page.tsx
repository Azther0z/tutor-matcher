"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/src/components/require-auth";
import { getAvailability } from "@/src/lib/bookings-api";

function LegacyBookingRedirect() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const router = useRouter();
  const query = useSearchParams().toString();
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getAvailability(subjectId)
      .then((data) => {
        if (!cancelled)
          router.replace(
            `/tutors/${data.subject.tutor.id}/${subjectId}${query ? `?${query}` : ""}`
          );
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, query, router]);
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[68rem] flex-1 px-4 py-6">
      {error ? (
        <>
          <p role="alert">This subject is unavailable.</p>
          <Link href="/search" className="text-brand-link underline">
            Find a tutor
          </Link>
        </>
      ) : (
        <p role="status">Opening subject…</p>
      )}
    </main>
  );
}

export default function SubjectBookingPage() {
  return (
    <Suspense fallback={<p>Opening subject…</p>}>
      <RequireAuth>
        <LegacyBookingRedirect />
      </RequireAuth>
    </Suspense>
  );
}
