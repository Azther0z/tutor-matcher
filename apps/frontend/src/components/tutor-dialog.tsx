"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const overlays: HTMLElement[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow = "";
let rootFocus: HTMLElement | null = null;

function syncBackgrounds() {
  const top = overlays[overlays.length - 1];
  if (top) {
    for (const node of Array.from(document.body.children)) {
      if (!(node instanceof HTMLElement)) continue;
      if (!originalInert.has(node)) originalInert.set(node, node.inert);
      node.inert = node !== top;
    }
    document.body.style.overflow = "hidden";
  } else {
    originalInert.forEach((inert, node) => {
      node.inert = inert;
    });
    originalInert.clear();
    document.body.style.overflow = originalOverflow;
  }
}

// Shared by the draft editor and its nested consent documents.
export function TutorDialog({
  title,
  titleId,
  onClose,
  onCloseButton = onClose,
  busy = false,
  children,
  footer,
  status,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  onCloseButton?: () => void;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  status?: "Saved" | "Not saved";
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });
  useEffect(() => {
    const overlay = overlayRef.current;
    const dialog = dialogRef.current;
    if (!overlay || !dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!overlays.length) {
      originalOverflow = document.body.style.overflow;
      rootFocus = previousFocus;
    }
    overlays.push(overlay);
    syncBackgrounds();
    dialog.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (overlays[overlays.length - 1] !== overlay) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) closeRef.current();
      }
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button, input, textarea, select, [tabindex="0"]'
          )
        ).filter((node) => !node.matches(":disabled") && !node.closest("[inert]"));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || !dialog.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !dialog.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      overlays.splice(overlays.indexOf(overlay), 1);
      syncBackgrounds();
      const target = overlays.length ? previousFocus : rootFocus;
      if (target?.isConnected) target.focus();
      else document.querySelector<HTMLElement>("[data-tutor-dialog-trigger]")?.focus();
      if (!overlays.length) rootFocus = null;
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-black/[.12] bg-background text-left shadow-xl dark:border-white/[.18]"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-black/[.12] bg-background px-6 py-4 dark:border-white/[.18]">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            {status && (
              <span
                aria-label="Draft status"
                className="rounded-md bg-black/[.05] px-2 py-1 text-xs font-medium dark:bg-white/[.08]"
              >
                {status}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label={`Close ${title}`}
            disabled={busy}
            onClick={onCloseButton}
            className="rounded-lg px-3 py-2 text-xl leading-none hover:bg-black/[.06] disabled:opacity-60 dark:hover:bg-white/[.1]"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-black/[.12] bg-background px-6 py-4 dark:border-white/[.18]">
            {footer}
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}
