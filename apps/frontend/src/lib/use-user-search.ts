import { useCallback, useEffect, useState } from "react";
import {
  searchUsers,
  type ManagedUserDetail,
  type UserRoleFilter,
  type UserSearchPage,
} from "@/src/lib/admin-users-api";
import { TutorApiError } from "@/src/lib/tutor-application";

export type UserSearch = { q: string; role: UserRoleFilter; page: number };

// The admin's user search: the query, the loaded page, and the row updates after an action.
export function useUserSearch() {
  const [search, setSearch] = useState<UserSearch>({ q: "", role: "all", page: 1 });
  const [results, setResults] = useState<UserSearchPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    searchUsers(search, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setResults(page);
        setError(null);
        setLoading(false);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setResults(null);
        setError(failure instanceof Error ? failure.message : "Could not load users.");
        setForbidden(failure instanceof TutorApiError && failure.status === 403);
        setLoading(false);
      });
    return () => controller.abort();
  }, [search]);

  function changeSearch(next: Partial<UserSearch>) {
    setSearch((current) => ({ ...current, ...next }));
    setLoading(true);
  }

  // A suspension or ban shows on the result row straight away.
  const updateRow = useCallback((updated: ManagedUserDetail) => {
    setResults(
      (current) =>
        current && {
          ...current,
          results: current.results.map((user) =>
            user.id === updated.id ? { ...user, restriction: updated.restriction } : user
          ),
        }
    );
  }, []);

  return { search, results, loading, error, forbidden, changeSearch, updateRow };
}
