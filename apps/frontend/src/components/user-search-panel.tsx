import { useState } from "react";
import { UserBadges } from "@/src/components/user-badges";
import type { UserRoleFilter } from "@/src/lib/admin-users-api";
import { button } from "@/src/lib/admin-users-style";
import type { useUserSearch } from "@/src/lib/use-user-search";

const roleFilters: { value: UserRoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "student", label: "Student" },
  { value: "tutor", label: "Tutor" },
];

// The name search, the role filter, and the paged list of matching accounts.
export function UserSearchPanel({
  state,
  selectedId,
  onSelect,
}: {
  state: ReturnType<typeof useUserSearch>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { search, results, loading, error, changeSearch } = state;
  const [draft, setDraft] = useState("");
  return (
    <section
      aria-label="User search"
      className="overflow-hidden rounded-lg border border-black/[.12] dark:border-white/[.18]"
    >
      <div className="flex flex-col gap-3 border-b border-black/[.12] p-4 dark:border-white/[.18]">
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            changeSearch({ q: draft, page: 1 });
          }}
        >
          <input
            type="search"
            aria-label="Search by name"
            placeholder="Search by name"
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-full border border-black/[.12] bg-transparent px-4 outline-none focus:border-foreground dark:border-white/[.18]"
          />
          <button type="submit" className={button}>
            Search
          </button>
        </form>
        <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-2">
          {roleFilters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={search.role === value}
              onClick={() => changeSearch({ role: value, page: 1 })}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                search.role === value
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-black/15 hover:border-violet-500 dark:border-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div role="alert" className="px-4 py-5 text-sm text-red-600 dark:text-red-400">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 font-medium underline"
            disabled={loading}
            onClick={() => changeSearch({})}
          >
            Retry user search
          </button>
        </div>
      )}
      {loading && !results && <p className="px-4 py-5 text-sm text-zinc-500">Loading users…</p>}
      {results && (
        <div aria-busy={loading}>
          <p aria-live="polite" className="px-4 pt-3 text-sm text-zinc-500">
            {results.total === 1 ? "1 user" : `${results.total} users`}
          </p>
          {results.results.length === 0 ? (
            <p className="px-4 py-5 text-sm text-zinc-500">No users match this search.</p>
          ) : (
            <ul className="divide-y divide-black/[.12] dark:divide-white/[.18]">
              {results.results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    aria-current={selectedId === user.id ? "true" : undefined}
                    onClick={() => onSelect(user.id)}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.05] ${
                      selectedId === user.id ? "bg-black/[.05] dark:bg-white/[.08]" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="block break-all text-sm text-zinc-500">{user.email}</span>
                    </span>
                    <UserBadges user={user} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.totalPages > 1 && (
            <nav
              aria-label="Result pages"
              className="flex items-center justify-between gap-3 border-t border-black/[.12] px-4 py-3 text-sm dark:border-white/[.18]"
            >
              <button
                type="button"
                className={button}
                disabled={loading || search.page <= 1}
                onClick={() => changeSearch({ page: search.page - 1 })}
              >
                Previous
              </button>
              <span>
                Page {results.page} of {results.totalPages}
              </span>
              <button
                type="button"
                className={button}
                disabled={loading || search.page >= results.totalPages}
                onClick={() => changeSearch({ page: search.page + 1 })}
              >
                Next
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
