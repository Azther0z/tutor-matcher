"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { getAuthToken } from "@/src/lib/auth";

type InboxMessage = {
  id: number;
  fromUserId: number;
  toUserId: number;
  message: string;
  createdAt: string;
  fromUser: { id: number; firstName: string; lastName: string };
};

type ThreadMessage = {
  id: number;
  fromUserId: number;
  toUserId: number;
  message: string;
  createdAt: string;
};

type Conversation = {
  userId: number;
  name: string;
  preview: string;
  timestamp: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MessagesPage() {
  return (
    <RequireAuth>
      <Suspense>
        <MessagesView />
      </Suspense>
    </RequireAuth>
  );
}

function MessagesView() {
  const searchParams = useSearchParams();
  const withUserId = searchParams.get("with");
  const withName = searchParams.get("name");

  const [inbox, setInbox] = useState<InboxMessage[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const [selected, setSelected] = useState<{ userId: number; name: string } | null>(
    withUserId ? { userId: Number(withUserId), name: withName ?? "Tutor" } : null
  );

  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Bumped after a successful send to re-trigger the fetch effects below
  // without calling them by reference from inside an effect.
  const [inboxVersion, setInboxVersion] = useState(0);
  const [threadVersion, setThreadVersion] = useState(0);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    fetch("/api/messages/inbox", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<InboxMessage[]>;
      })
      .then((data) => {
        setInbox(data);
        setSelected((current) => {
          if (current) return current;
          const [first] = data;
          return first
            ? {
                userId: first.fromUserId,
                name: `${first.fromUser.firstName} ${first.fromUser.lastName}`,
              }
            : null;
        });
      })
      .catch(() => setInboxError("Could not load your messages. Please refresh and try again."));
  }, [inboxVersion]);

  useEffect(() => {
    if (!selected) return;
    const token = getAuthToken();
    if (!token) return;

    fetch(`/api/messages/thread/${selected.userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<ThreadMessage[]>;
      })
      .then((data) => {
        setThread(data);
        setThreadError(null);
      })
      .catch(() => setThreadError("Could not load this conversation. Please try again."));
  }, [selected, threadVersion]);

  async function handleSend() {
    if (!selected || !draft.trim()) return;
    const token = getAuthToken();
    if (!token) return;

    setSending(true);
    setSendError(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId: selected.userId, message: draft.trim() }),
      });

      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        setSendError(data?.message ?? "Could not send your message. Please try again.");
        return;
      }

      setDraft("");
      setThreadVersion((v) => v + 1);
      setInboxVersion((v) => v + 1);
    } catch {
      setSendError("Could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const conversations: Conversation[] = [];
  if (inbox) {
    const seen = new Set<number>();
    for (const item of inbox) {
      if (seen.has(item.fromUserId)) continue;
      seen.add(item.fromUserId);
      conversations.push({
        userId: item.fromUserId,
        name: `${item.fromUser.firstName} ${item.fromUser.lastName}`,
        preview: item.message,
        timestamp: item.createdAt,
      });
    }
  }

  const selectedIsNew =
    selected !== null &&
    !conversations.some((c) => c.userId === selected.userId) &&
    (thread === null || thread.length === 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
      </div>

      {inboxError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {inboxError}
        </p>
      )}

      <div className="flex min-h-[28rem] flex-1 overflow-hidden rounded-2xl border border-black/[.12] dark:border-white/[.18]">
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-black/[.12] dark:border-white/[.18]">
          {inbox === null ? (
            <p className="p-4 text-sm text-zinc-500">Loading…</p>
          ) : conversations.length === 0 && !selected ? (
            <p className="p-4 text-sm text-zinc-500">No messages yet.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.userId}
                type="button"
                onClick={() =>
                  setSelected({ userId: conversation.userId, name: conversation.name })
                }
                className={`flex items-start gap-3 border-b border-black/[.06] p-4 text-left transition-colors last:border-b-0 hover:bg-black/[.03] dark:border-white/[.08] dark:hover:bg-white/[.06] ${
                  selected?.userId === conversation.userId
                    ? "bg-black/[.04] dark:bg-white/[.08]"
                    : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
                  {initials(conversation.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{conversation.name}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {formatTime(conversation.timestamp)}
                    </span>
                  </span>
                  <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                    {conversation.preview}
                  </span>
                </span>
              </button>
            ))
          )}

          {selectedIsNew && selected && (
            <div className="flex items-start gap-3 border-b border-black/[.06] bg-black/[.04] p-4 dark:border-white/[.08] dark:bg-white/[.08]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
                {initials(selected.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{selected.name}</span>
                <span className="truncate text-sm text-zinc-500">Start the conversation</span>
              </span>
            </div>
          )}
        </aside>

        <section className="flex flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500">
              Select a conversation to see messages.
            </div>
          ) : (
            <>
              <header className="border-b border-black/[.12] p-4 font-medium dark:border-white/[.18]">
                {selected.name}
              </header>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                {threadError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {threadError}
                  </p>
                )}
                {thread === null ? (
                  <p className="text-sm text-zinc-500">Loading…</p>
                ) : thread.length === 0 ? (
                  <p className="text-sm text-zinc-500">No messages yet — say hi!</p>
                ) : (
                  thread.map((item) => {
                    const isMine = item.toUserId === selected.userId;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                            isMine
                              ? "bg-foreground text-background"
                              : "border border-black/[.12] dark:border-white/[.18]"
                          }`}
                        >
                          {item.message}
                        </div>
                        <span className="text-xs text-zinc-500">{formatTime(item.createdAt)}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSend();
                }}
                className="flex items-end gap-2 border-t border-black/[.12] p-4 dark:border-white/[.18]"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Write a message…"
                  rows={1}
                  className="h-11 flex-1 resize-none overflow-y-auto rounded-lg border border-black/[.12] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground dark:border-white/[.18]"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
              {sendError && (
                <p role="alert" className="px-4 pb-4 text-sm text-red-600 dark:text-red-400">
                  {sendError}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
