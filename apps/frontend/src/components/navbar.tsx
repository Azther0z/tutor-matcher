"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/src/components/auth-provider";
import { clearAuthToken, getAuthToken, type AuthUser } from "@/src/lib/auth";
import { getWallet, subscribeToWalletBalance } from "@/src/lib/wallet-api";

type NavLink = {
  label: string;
  href: string;
};

const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Find tutors", href: "/search" },
  { label: "Bookings", href: "/bookings" },
  { label: "Messages", href: "/messages" },
];

const walletFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function navItemClass(active: boolean) {
  return `flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
    active
      ? "bg-brand-soft text-brand-link"
      : "text-secondary hover:bg-surface-muted hover:text-foreground"
  }`;
}

function displayName(user: AuthUser | null) {
  const firstName = user?.firstName?.trim();
  const lastName = user?.lastName?.trim();

  if (firstName && lastName) return `${firstName} ${lastName.charAt(0)}.`;
  return firstName || user?.email || "User";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  // Tracks only the last-fetched tutor status; whether that counts as
  // "approved" is derived below so a logged-out/loading state never shows as
  // approved without needing a separate effect to reset it.
  const [tutorStatus, setTutorStatus] = useState<string | null>(null);
  const isApprovedTutor = status === "authenticated" && tutorStatus === "APPROVED";
  // Hides the call to apply only; an admin can still open /enroll-tutor directly.
  const isAdmin = status === "authenticated" && user?.isAdmin === true;
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [walletSummary, setWalletSummary] = useState<{
    owner: string;
    balance: string;
  } | null>(null);
  const [walletErrorOwner, setWalletErrorOwner] = useState<string | null>(null);
  const walletOwner = `${user?.email ?? ""}:${user?.firstName ?? ""}:${user?.lastName ?? ""}`;
  const walletBalance = walletSummary?.owner === walletOwner ? walletSummary.balance : null;
  const walletStatus =
    walletBalance !== null ? "ready" : walletErrorOwner === walletOwner ? "error" : "loading";

  useEffect(() => {
    if (status !== "authenticated" || !user) return;

    let cancelled = false;
    function updateBalance(balance: string) {
      if (cancelled) return;
      setWalletSummary({ owner: walletOwner, balance });
      setWalletErrorOwner(null);
    }
    const unsubscribe = subscribeToWalletBalance((balance) => {
      updateBalance(balance);
    });

    getWallet()
      .then((wallet) => updateBalance(wallet.balance))
      .catch(() => {
        if (!cancelled) setWalletErrorOwner(walletOwner);
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [status, user, walletOwner]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const token = getAuthToken();
    if (!token) return;

    fetch("/api/messages/inbox", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((inbox: unknown[]) => setHasUnreadMessages(inbox.length > 0))
      .catch(() => setHasUnreadMessages(false));
  }, [status, pathname]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const token = getAuthToken();
    if (!token) return;

    let cancelled = false;

    fetch("/api/profiles/me/tutor", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { status: string } | null) => {
        if (!cancelled) setTutorStatus(data?.status ?? null);
      })
      .catch(() => {
        if (!cancelled) setTutorStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, status]);

  useEffect(() => {
    if (!menuOpen && !mobileOpen) return;

    function handleOutsideClick(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setMobileOpen(false);
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
        if (mobileOpen) mobileButtonRef.current?.focus();
        else if (menuOpen) accountButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.getElementById("primary-navigation")?.querySelector<HTMLAnchorElement>("a")?.focus();
    }
  }, [mobileOpen]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function handleLogout() {
    clearAuthToken();
    setWalletSummary(null);
    setWalletErrorOwner(null);
    setMenuOpen(false);
    router.push("/");
  }

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-line bg-surface">
      <nav
        aria-label="Main navigation"
        className="relative mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          aria-label="Tutor Matcher home"
          translate="no"
          className="max-[380px]:max-w-24 shrink-0 text-base font-semibold tracking-tight text-foreground sm:text-lg"
        >
          Tutor <span className="text-brand-link">Matcher</span>
        </Link>
        <div
          id="primary-navigation"
          className={`${mobileOpen ? "flex" : "hidden"} absolute inset-x-0 top-full max-h-[calc(100dvh-5rem)] flex-col gap-1 overflow-y-auto border-b border-line bg-surface p-4 shadow-sm xl:flex xl:flex-row xl:items-center xl:overflow-visible xl:border-0 xl:p-0 xl:shadow-none ${isApprovedTutor ? "xl:inset-x-auto xl:left-1/2 xl:top-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2" : "xl:static"}`}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={`${navItemClass(isActive(link.href))} ${
                link.href === "/messages" ? "relative pr-6" : ""
              }`}
            >
              {link.label}
              {link.href === "/messages" && (
                <span
                  aria-label={
                    status === "authenticated" && hasUnreadMessages ? "New messages" : undefined
                  }
                  aria-hidden={status !== "authenticated" || !hasUnreadMessages}
                  className={`absolute top-1/2 right-3 h-2 w-2 -translate-y-1/2 rounded-full ${
                    status === "authenticated" && hasUnreadMessages
                      ? "bg-brand-navy"
                      : "bg-transparent"
                  }`}
                />
              )}
            </Link>
          ))}
          {!isApprovedTutor && !isAdmin && (
            <Link
              href="/enroll-tutor"
              onClick={() => setMobileOpen(false)}
              className="ui-button-secondary w-[9.25rem] shrink-0 justify-center xl:ml-2"
            >
              Become a tutor
            </Link>
          )}
          {isAdmin && !isApprovedTutor && (
            <span
              aria-hidden="true"
              className="hidden h-11 w-[9.25rem] shrink-0 xl:ml-2 xl:block"
            />
          )}
        </div>
        <div className="flex w-[9.25rem] shrink-0 items-center justify-end gap-2 sm:w-[16.5rem] xl:w-[13.25rem]">
          {status === "authenticated" && user ? (
            <div ref={menuRef} className="relative flex items-center gap-2">
              <Link
                href="/wallet"
                aria-label="Wallet balance"
                aria-busy={walletStatus === "loading"}
                title="View your wallet"
                onClick={() => {
                  setMenuOpen(false);
                  setMobileOpen(false);
                }}
                className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line px-2 text-sm font-medium tabular-nums text-foreground transition-colors hover:bg-surface-muted sm:w-40"
              >
                <span className="sm:hidden" aria-hidden="true">
                  ฿
                </span>
                <span className="hidden sm:inline">
                  {walletStatus === "error" ? (
                    "฿ —"
                  ) : (
                    <>฿ {walletFormat.format(Number(walletBalance ?? 0))}</>
                  )}
                </span>
              </Link>
              <button
                type="button"
                ref={accountButtonRef}
                aria-label="Open account menu"
                aria-expanded={menuOpen}
                aria-controls="account-navigation"
                onClick={() => {
                  setMenuOpen((open) => !open);
                  setMobileOpen(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-muted transition-colors hover:border-brand-link"
              >
                <Image src="/profile-circle.svg" alt="" width={22} height={22} />
              </button>
              {menuOpen && (
                <div
                  id="account-navigation"
                  className="absolute top-full right-0 z-50 mt-3 max-h-[calc(100dvh-7rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-lg"
                >
                  <p className="break-words border-b border-line px-3 py-3 text-sm text-secondary">
                    Signed in as{" "}
                    <strong className="font-medium text-foreground">{displayName(user)}</strong>
                  </p>
                  {[
                    { label: "Wallet", href: "/wallet" },
                    { label: "Settings", href: "/settings/account" },
                    ...(user.isAdmin
                      ? [
                          { label: "Tutor requests", href: "/admin/tutor-requests" },
                          { label: "Users", href: "/admin/users" },
                          { label: "Top-up requests", href: "/admin/topups" },
                          { label: "Refund requests", href: "/admin/refunds" },
                          { label: "Flagged reviews", href: "/admin/reviews" },
                        ]
                      : []),
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={navItemClass(isActive(link.href))}
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="my-2 border-t border-line" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-secondary hover:bg-surface-muted hover:text-foreground"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : status === "loading" ? (
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="h-11 w-11 sm:w-40" />
              <span className="h-11 w-11 rounded-full bg-surface-muted" />
            </div>
          ) : status === "unauthenticated" ? (
            <>
              <Link href="/login" className={navItemClass(pathname.startsWith("/login"))}>
                Login
              </Link>
              <Link href="/signup" className="ui-button hidden sm:inline-flex">
                Sign-up
              </Link>
            </>
          ) : null}
          <button
            ref={mobileButtonRef}
            type="button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="primary-navigation"
            onClick={() => {
              setMobileOpen((open) => !open);
              setMenuOpen(false);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-foreground hover:bg-surface-muted xl:hidden"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              {mobileOpen ? (
                <path d="m6 6 12 12M6 18 18 6" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
