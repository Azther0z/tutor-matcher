export const AUTH_TOKEN_KEY = "authToken";
const AUTH_CHANGE_EVENT = "tutor-matcher-auth-change";

export type AuthUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function subscribeToAuth(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_CHANGE_EVENT, callback);
  };
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
