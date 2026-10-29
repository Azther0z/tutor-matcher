import { clearAuthToken, getAuthToken } from "@/src/lib/auth";

type AuthMode = "optional" | "required";

type ApiOptions = Omit<RequestInit, "body"> & {
  auth?: AuthMode;
  clearOnUnauthorized?: boolean;
  json?: unknown;
  missingAuthError?: () => Error;
  missingAuthMessage?: string;
};

export type ApiResult<T> = {
  body: T | null;
  response: Response;
};

export type ApiFailure = {
  body: unknown;
  response: Response;
};

function mergeHeaders(options: ApiOptions, token: string | null) {
  const headers: Record<string, string> = Array.isArray(options.headers)
    ? Object.fromEntries(options.headers)
    : options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.json !== undefined && !new Headers(headers).has("Content-Type")) {
    headers["Content-Type"] = "application/json";
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

export async function readApi<T>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const token = options.auth ? getAuthToken() : null;
  if (options.auth === "required" && !token) {
    throw (
      options.missingAuthError?.() ??
      new Error(options.missingAuthMessage ?? "Please log in to continue.")
    );
  }

  const { clearOnUnauthorized, json } = options;
  const init = { ...options };
  delete init.auth;
  delete init.clearOnUnauthorized;
  delete init.json;
  delete init.missingAuthError;
  delete init.missingAuthMessage;
  const response = await fetch(path, {
    ...init,
    headers: mergeHeaders(options, token),
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });
  const body = (await response.json().catch(() => null)) as T | null;

  if (response.status === 401 && clearOnUnauthorized && token) clearAuthToken();
  return { body, response };
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions & {
    emptyBody?: () => T;
    errorMessage: string;
    makeError?: (failure: ApiFailure) => Error;
  }
): Promise<T> {
  const { emptyBody, errorMessage, makeError, ...request } = options;
  const result = await readApi<T>(path, request);
  if (!result.response.ok) {
    throw makeError?.(result) ?? new Error(errorMessage);
  }
  if (result.body === null) {
    if (emptyBody) return emptyBody();
    throw makeError?.(result) ?? new Error(errorMessage);
  }
  return result.body;
}
