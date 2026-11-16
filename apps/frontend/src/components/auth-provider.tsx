"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clearAuthToken, getAuthToken, subscribeToAuth, type AuthUser } from "@/src/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  // SAFE-1: why the server ended the session (a suspension or ban), kept until the next sign-in.
  notice: string | null;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: "loading",
  notice: null,
});

// An unknown account or a rejected token (401/404) ends the session. So does an Admin's
// suspension or ban (403 ACCOUNT_RESTRICTED), whose message says why.
async function readSession(token: string, signal: AbortSignal) {
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (response.status === 401 || response.status === 404) {
    return { ended: true, notice: null } as const;
  }
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    if (body?.code === "ACCOUNT_RESTRICTED") {
      return { ended: true, notice: body.message ?? null } as const;
    }
  }
  if (!response.ok) throw new Error("Could not load the current user");

  return { ended: false, user: (await response.json()) as AuthUser } as const;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const checkedPathRef = useRef(pathname);

  useEffect(() => {
    async function loadCurrentUser() {
      controllerRef.current?.abort();
      const runId = ++runIdRef.current;
      const controller = new AbortController();
      controllerRef.current = controller;
      const isCurrentRun = () => runId === runIdRef.current && !controller.signal.aborted;
      const token = getAuthToken();

      if (!token) {
        if (isCurrentRun()) {
          setUser(null);
          setStatus("unauthenticated");
        }
        return;
      }

      setStatus("loading");

      try {
        const session = await readSession(token, controller.signal);

        if (session.ended) {
          if (!isCurrentRun()) return;
          if (session.notice) setNotice(session.notice);
          clearAuthToken();
          return;
        }

        if (isCurrentRun()) {
          setUser(session.user);
          setStatus("authenticated");
          setNotice(null);
        }
      } catch (error) {
        if (!isCurrentRun() || (error as DOMException).name === "AbortError") return;
        setUser(null);
        setStatus("error");
      }
    }

    void loadCurrentUser();
    const unsubscribe = subscribeToAuth(() => void loadCurrentUser());

    return () => {
      controllerRef.current?.abort();
      runIdRef.current += 1;
      unsubscribe();
    };
  }, []);

  // SAFE-1: check the session again after each navigation, so a suspension or ban also ends a
  // session that is already open. The signed-in view stays on screen while the check runs.
  useEffect(() => {
    if (checkedPathRef.current === pathname) return;
    checkedPathRef.current = pathname;
    const token = getAuthToken();
    if (!token) return;

    const controller = new AbortController();
    readSession(token, controller.signal)
      .then((session) => {
        if (controller.signal.aborted || !session.ended || getAuthToken() !== token) return;
        if (session.notice) setNotice(session.notice);
        clearAuthToken();
      })
      .catch(() => {
        // A failed check leaves the session alone; the next navigation checks again.
      });
    return () => controller.abort();
  }, [pathname]);

  const value = useMemo(() => ({ user, status, notice }), [notice, status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
