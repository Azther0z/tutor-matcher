"use client";

import { useState } from "react";
import { ManagedUserPanel } from "@/src/components/managed-user-panel";
import { RequireAuth } from "@/src/components/require-auth";
import { UserSearchPanel } from "@/src/components/user-search-panel";
import { useUserSearch } from "@/src/lib/use-user-search";

const shell = "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-16";

export default function AdminUsersPage() {
  return (
    <RequireAuth>
      <UserManagement />
    </RequireAuth>
  );
}

function UserManagement() {
  const state = useUserSearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <main className={shell}>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Users</h1>
        <p className="mt-3 text-zinc-500">
          Search accounts by name, then message, suspend or ban the selected user. A suspension
          lifts automatically when it ends; a ban is permanent.
        </p>
      </div>
      {state.forbidden ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          Admin access required. You do not have permission to manage users.
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <UserSearchPanel state={state} selectedId={selectedId} onSelect={setSelectedId} />
          {selectedId ? (
            <ManagedUserPanel key={selectedId} userId={selectedId} onUpdated={state.updateRow} />
          ) : (
            <p className="rounded-lg border border-dashed border-black/[.12] p-6 text-sm text-zinc-500 dark:border-white/[.18]">
              Select a user to message, suspend or ban them.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
