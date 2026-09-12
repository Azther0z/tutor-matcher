"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clearAuthToken, getAuthToken, subscribeToAuth, type AuthUser } from "@/src/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
};

const AuthContext = createContext<AuthContextValue>({ user: null, status: "loading" });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const runIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

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
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 404) {
          clearAuthToken();
          return;
        }

        if (!response.ok) throw new Error("Could not load the current user");

        const currentUser = (await response.json()) as AuthUser;
        if (isCurrentRun()) {
          setUser(currentUser);
          setStatus("authenticated");
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

  const value = useMemo(() => ({ user, status }), [status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
