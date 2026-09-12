"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/src/components/auth-provider";
import { clearAuthToken, type AuthUser } from "@/src/lib/auth";

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

function navItemClass(active: boolean) {
  return `rounded-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "border-transparent bg-[#202020] text-white shadow-sm"
      : "border-transparent text-zinc-400 hover:bg-[#111111] hover:text-white"
  }`;
}

function displayName(user: AuthUser | null) {
  const firstName = user?.firstName?.trim();
  const lastName = user?.lastName?.trim();

  if (firstName && lastName) return `${firstName} ${lastName.charAt(0)}.`;
  return firstName || user?.email || "User";
}

function avatarInitial(user: AuthUser | null) {
  return user?.firstName?.trim().charAt(0).toUpperCase() || "U";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function handleLogout() {
    clearAuthToken();
    setMenuOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navItemClass(isActive(link.href))}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {status === "authenticated" && user ? (
            <div ref={menuRef} className="relative flex items-center gap-3">
              <span
                aria-label="Wallet balance"
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200"
              >
                ฿ 0
              </span>
              <button
                type="button"
                aria-label="Open account menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-950 ring-4 ring-emerald-100/20 transition-colors hover:bg-emerald-200"
              >
                {avatarInitial(user)}
              </button>

              {menuOpen && (
                <div className="absolute top-full right-0 z-50 mt-3 w-max min-w-48 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-700 bg-[#111111] p-2 shadow-xl">
                  <p className="break-words px-4 py-3 text-sm text-zinc-400">
                    Signed in as <strong className="text-zinc-200">{displayName(user)}</strong>
                  </p>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-4 py-3 text-sm text-zinc-200 hover:bg-[#202020] hover:text-white"
                  >
                    Settings
                  </Link>
                  <div className="my-2 border-t border-zinc-700" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded-xl px-4 py-3 text-left text-sm text-zinc-200 hover:bg-[#202020] hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : status === "unauthenticated" ? (
            <>
              <Link href="/login" className={navItemClass(pathname.startsWith("/login"))}>
                Login
              </Link>
              <Link href="/signup" className={navItemClass(pathname.startsWith("/signup"))}>
                Sign-up
              </Link>
            </>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
