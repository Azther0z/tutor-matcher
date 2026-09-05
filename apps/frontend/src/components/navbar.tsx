"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  clearAuthToken,
  getAuthServerSnapshot,
  getAuthSnapshot,
  subscribeToAuth,
} from "@/src/lib/auth";

type NavLink = {
  label: string;
  href: string;
  soon?: boolean;
};

const SUBJECT_CATEGORIES = ["Maths", "English", "Science", "Coding", "Music"];

const NAV_LINKS: NavLink[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Bookings", href: "/bookings" },
  { label: "Messages", href: "/messages", soon: true },
];

function navItemClass(active: boolean) {
  return `rounded-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "border-brand-navy text-brand-navy"
      : "border-transparent text-zinc-600 hover:bg-brand-surface hover:text-brand-navy"
  }`;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const isAuthed = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getAuthServerSnapshot);
  const subjectsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (subjectsRef.current && !subjectsRef.current.contains(event.target as Node)) {
        setSubjectsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function handleLogout() {
    clearAuthToken();
    setProfileOpen(false);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-brand-navy-dark">
          Tutor Matcher
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          <Link href="/" className={navItemClass(isActive("/"))}>
            Home
          </Link>

          <div ref={subjectsRef} className="relative">
            <button
              type="button"
              onClick={() => setSubjectsOpen((open) => !open)}
              className={`flex cursor-pointer items-center gap-1 ${navItemClass(isActive("/search"))}`}
            >
              Find tutors
              <Image
                src="/chevron-down.svg"
                alt=""
                width={10}
                height={10}
                className={`transition-transform ${subjectsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {subjectsOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
                <Link
                  href="/search"
                  onClick={() => setSubjectsOpen(false)}
                  className="block px-4 py-2 text-sm font-medium text-brand-navy-dark hover:bg-brand-surface"
                >
                  All subjects
                </Link>
                <div className="my-1 border-t border-zinc-100" />
                {SUBJECT_CATEGORIES.map((subject) => (
                  <Link
                    key={subject}
                    href={`/search?subject=${encodeURIComponent(subject)}`}
                    onClick={() => setSubjectsOpen(false)}
                    className="block px-4 py-2 text-sm text-zinc-600 hover:bg-brand-surface hover:text-brand-navy-dark"
                  >
                    {subject}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {NAV_LINKS.map((link) =>
            link.soon ? (
              <span
                key={link.href}
                aria-disabled="true"
                className="flex cursor-default items-center gap-1.5 rounded-lg border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-400"
              >
                {link.label}
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-400">
                  Soon
                </span>
              </span>
            ) : (
              <Link key={link.href} href={link.href} className={navItemClass(isActive(link.href))}>
                {link.label}
              </Link>
            )
          )}

          <Link
            href="/enroll-tutor"
            className="rounded-full bg-brand-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-navy-dark"
          >
            Become a tutor
          </Link>
        </div>

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label="Open account menu"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-zinc-200 transition-colors hover:border-brand-navy hover:bg-brand-surface"
          >
            <Image src="/profile-circle.svg" alt="" width={22} height={22} />
          </button>

          {profileOpen &&
            (isAuthed ? (
              <div className="absolute top-full right-0 mt-2 w-44 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
                <Link
                  href="/settings/account"
                  onClick={() => setProfileOpen(false)}
                  className="block px-4 py-2 text-sm text-zinc-600 hover:bg-brand-surface hover:text-brand-navy-dark"
                >
                  Settings
                </Link>
                <Link
                  href="/payments"
                  onClick={() => setProfileOpen(false)}
                  className="block px-4 py-2 text-sm text-zinc-600 hover:bg-brand-surface hover:text-brand-navy-dark"
                >
                  Wallet
                </Link>
                <div className="my-1 border-t border-zinc-100" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full cursor-pointer px-4 py-2 text-left text-sm text-zinc-600 hover:bg-brand-surface hover:text-brand-navy-dark"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="absolute top-full right-0 mt-2 w-44 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
                <Link
                  href="/login"
                  onClick={() => setProfileOpen(false)}
                  className="block px-4 py-2 text-sm text-zinc-600 hover:bg-brand-surface hover:text-brand-navy-dark"
                >
                  Log in
                </Link>
              </div>
            ))}
        </div>
      </nav>
    </header>
  );
}
