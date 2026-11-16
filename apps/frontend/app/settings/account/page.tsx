"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { SettingsSidebar } from "@/src/components/settings-sidebar";
import { NameForm } from "@/src/components/name-form";
import { EmailForm } from "@/src/components/email-form";
import { PasswordForm } from "@/src/components/password-form";
import { getAuthToken } from "@/src/lib/auth";
import { loadAccount, type AccountRecord } from "@/src/lib/account-api";

export default function AccountSettingsPage() {
  return (
    <RequireAuth>
      <AccountSettings />
    </RequireAuth>
  );
}

function AccountSettings() {
  const [account, setAccount] = useState<AccountRecord>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const controller = new AbortController();
    loadAccount(token, controller.signal)
      .then(setAccount)
      .catch((error: unknown) => {
        if ((error as DOMException)?.name !== "AbortError")
          setLoadError("We could not load your account settings. Please refresh and try again.");
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16 sm:flex-row">
      <SettingsSidebar activeSection="account" />
      <div className="flex flex-1 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Tutor Matcher
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Account settings</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Update your name, email address, and password you sign in with.
          </p>
        </div>
        {loadError && (
          <p role="status" className="text-sm text-red-600 dark:text-red-400">
            {loadError}
          </p>
        )}
        <NameForm
          key={`name:${account.firstName ?? ""}:${account.lastName ?? ""}`}
          first={account.firstName ?? ""}
          last={account.lastName ?? ""}
        />
        <EmailForm key={`email:${account.email ?? ""}`} initialEmail={account.email ?? ""} />
        <PasswordForm />
      </div>
    </main>
  );
}
