"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { getAuthServerSnapshot, getAuthSnapshot, subscribeToAuth } from "@/src/lib/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthed = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getAuthServerSnapshot);

  useEffect(() => {
    // isAuthed is null until the client has actually read localStorage (see
    // getAuthServerSnapshot) — only redirect once we have a definitive "no token".
    if (isAuthed === false) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthed, pathname, router]);

  if (isAuthed !== true) return null;
  return <>{children}</>;
}
