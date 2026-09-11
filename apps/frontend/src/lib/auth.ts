export const AUTH_TOKEN_KEY = "authToken";

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function subscribeToAuth(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// The client snapshot always resolves definitively (true/false); `getAuthServerSnapshot`
// returns null to mean "not checked yet" so consumers can tell "definitely logged out"
// apart from "haven't read localStorage on this client yet" during hydration.
export function getAuthSnapshot(): boolean | null {
  return !!getAuthToken();
}

export function getAuthServerSnapshot(): boolean | null {
  return null;
}
