"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/src/components/auth-provider";

const links = [
  { href: "/admin/tutor-requests", label: "Tutor requests" },
  { href: "/admin/topups", label: "Top-ups" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/reviews", label: "Flagged reviews" },
  { href: "/admin/users", label: "Users" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user?.isAdmin) return null;

  return (
    <nav aria-label="Admin sections" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-medium transition-colors ${pathname === href ? "bg-brand-soft text-brand-link" : "text-secondary hover:bg-surface-muted"}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
