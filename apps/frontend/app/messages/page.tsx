"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { formatBangkokDateTime } from "@/src/lib/date-time";
import { getAuthToken } from "@/src/lib/auth";

// MSG-1: one entry per person the user wrote to or heard from, newest first.
type ConversationSummary = {
  userId: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string;
  sentByMe: boolean;
};

type ThreadMessage = {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  createdAt: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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

  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [selected, setSelected] = useState<{ userId: string; name: string } | null>(
    withUserId ? { userId: withUserId, name: withName ?? "Tutor" } : null
  );

  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Bumped after a successful send to re-trigger the fetch effects below
  // without calling them by reference from inside an effect.
  const [listVersion, setListVersion] = useState(0);
  const [threadVersion, setThreadVersion] = useState(0);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    fetch("/api/messages/conversations", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<ConversationSummary[]>;
      })
      .then((data) => {
        setConversations(data);
        setSelected((current) => {
          if (current) return current;
          const [first] = data;
          return first ? { userId: first.userId, name: first.name } : null;
        });
      })
      .catch(() => setListError("Could not load your messages. Please refresh and try again."));
  }, [listVersion]);

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

  const threadScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread]);

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
      setListVersion((v) => v + 1);
    } catch {
      setSendError("Could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const selectedIsNew =
    selected !== null &&
    !conversations?.some((c) => c.userId === selected.userId) &&
    (thread === null || thread.length === 0);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10"
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">Tutor Matcher</p>
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
      </div>

      {listError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {listError}
        </p>
      )}

      <div className="flex h-[42rem] flex-col overflow-hidden bg-surface md:h-[36rem] md:flex-row rounded-2xl border border-line bg-surface">
        <aside className="flex max-h-44 min-h-0 w-full shrink-0 flex-col overflow-y-auto border-b border-line md:max-h-none md:w-72 md:border-r md:border-b-0">
          {conversations === null ? (
            <p className="p-4 text-sm text-muted">Loading…</p>
          ) : conversations.length === 0 && !selected ? (
            <p className="p-4 text-sm text-muted">No messages yet.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.userId}
                type="button"
                onClick={() =>
                  setSelected({ userId: conversation.userId, name: conversation.name })
                }
                className={`flex items-start gap-3 border-b border-line p-4 text-left transition-colors last:border-b-0 hover:bg-surface-muted   ${
                  selected?.userId === conversation.userId ? "bg-surface-muted" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-sm font-medium text-white">
                  {initials(conversation.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{conversation.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatBangkokDateTime(conversation.lastMessageAt)}
                    </span>
                  </span>
                  <span className="truncate text-sm text-secondary">
                    {conversation.sentByMe && "You: "}
                    {conversation.lastMessage}
                  </span>
                </span>
              </button>
            ))
          )}

          {selectedIsNew && selected && (
            <div className="flex items-start gap-3 border-b border-line bg-surface-muted p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-sm font-medium text-white">
                {initials(selected.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{selected.name}</span>
                <span className="truncate text-sm text-muted">Start the conversation</span>
              </span>
            </div>
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted">
              Select a conversation to see messages.
            </div>
          ) : (
            <>
              <header className="border-b border-line p-4 font-medium">{selected.name}</header>

              <div
                ref={threadScrollRef}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
              >
                {threadError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {threadError}
                  </p>
                )}
                {thread === null ? (
                  <p className="text-sm text-muted">Loading…</p>
                ) : thread.length === 0 ? (
                  <p className="text-sm text-muted">No messages yet. Start the conversation.</p>
                ) : (
                  thread.map((item) => {
                    const isMine = item.toUserId === selected.userId;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] break-words rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                            isMine ? "bg-brand-navy text-white" : "border border-line"
                          }`}
                        >
                          {item.message}
                        </div>
                        <span className="text-xs text-muted">
                          {formatBangkokDateTime(item.createdAt)}
                        </span>
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
                className="flex items-end gap-2 border-t border-line p-4"
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
                  aria-label="Message"
                  placeholder="Write a message…"
                  rows={1}
                  className="h-11 flex-1 resize-none overflow-y-auto rounded-lg border border-line bg-transparent px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-brand-link focus:border-foreground"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-11 items-center justify-center rounded-lg bg-brand-navy px-5 text-sm font-medium text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-60"
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
