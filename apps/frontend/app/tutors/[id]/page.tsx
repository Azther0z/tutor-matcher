"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { getAuthToken } from "@/src/lib/auth";

type TutorSummary = {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
};

export default function TutorDetailPage() {
  return (
    <RequireAuth>
      <TutorDetailView />
    </RequireAuth>
  );
}

function TutorDetailView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [tutor, setTutor] = useState<TutorSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    fetch(`/api/discovery/tutors/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<TutorSummary>;
      })
      .then((data) => setTutor(data))
      .catch(() => setLoadError("Could not load this tutor's profile."));
  }, [params.id]);

  async function handleSend() {
    if (!tutor || !draft.trim()) return;
    const token = getAuthToken();
    if (!token) return;

    setSending(true);
    setSendError(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId: tutor.userId, message: draft.trim() }),
      });

      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        setSendError(data?.message ?? "Could not send your message. Please try again.");
        return;
      }

      const name = encodeURIComponent(`${tutor.firstName} ${tutor.lastName}`);
      router.push(`/messages?with=${tutor.userId}&name=${name}`);
    } catch {
      setSendError("Could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16">
        <p role="alert" className="text-red-600 dark:text-red-400">
          {loadError}
        </p>
      </main>
    );
  }

  if (!tutor) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16">
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {tutor.firstName} {tutor.lastName}
        </h1>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
        <h2 className="text-xl font-semibold">Message {tutor.firstName}</h2>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask ${tutor.firstName} a question before booking…`}
          rows={4}
          className="resize-none rounded-lg border border-black/[.12] bg-transparent px-3 py-2.5 text-base outline-none focus:border-foreground dark:border-white/[.18]"
        />
        {sendError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {sendError}
          </p>
        )}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="flex h-11 w-fit items-center justify-center rounded-full bg-foreground px-5 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {sending ? "Sending…" : `Message ${tutor.firstName}`}
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
        <h2 className="text-xl font-semibold">Full profile coming soon</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Bio, subjects, availability, and reviews will be implemented here.
        </p>
        <p className="text-sm text-zinc-500">Backlog: DISC-3, REV-2, REV-3</p>
      </section>
    </main>
  );
}
