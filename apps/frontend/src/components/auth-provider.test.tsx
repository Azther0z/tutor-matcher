import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-provider";
import { setAuthToken } from "@/src/lib/auth";
import { jsonResponse } from "@/src/test/tutor-profile-fixtures";

const fetchMock = jest.fn();
let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

const banned = "This account has been banned. Reason: Fraud";
const suspended = "This account is suspended until 2 Nov 2026, 14:00 (Bangkok time). Reason: Spam";
const restricted = (message: string) =>
  jsonResponse({ code: "ACCOUNT_RESTRICTED", message, restriction: {} }, 403);

function Session() {
  const { status, user, notice } = useAuth();
  return (
    <>
      <p data-testid="status">{status}</p>
      <p data-testid="email">{user?.email}</p>
      <p data-testid="notice">{notice}</p>
    </>
  );
}

const app = () => (
  <AuthProvider>
    <Session />
  </AuthProvider>
);

async function signedInAs(email: string) {
  localStorage.setItem("authToken", "session-token");
  fetchMock.mockResolvedValueOnce(jsonResponse({ email }));
  const view = render(app());
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
  return view;
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  mockPathname = "/dashboard";
});

it("ends the session of a banned account and keeps the reason", async () => {
  localStorage.setItem("authToken", "session-token");
  fetchMock.mockResolvedValueOnce(restricted(banned));
  render(app());

  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
  expect(screen.getByTestId("notice")).toHaveTextContent(banned);
  expect(localStorage.getItem("authToken")).toBeNull();
});

it("checks an open session again after navigation and ends it once suspended", async () => {
  const { rerender } = await signedInAs("bob@example.com");
  expect(fetchMock).toHaveBeenCalledTimes(1);

  rerender(app());
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fetchMock.mockResolvedValueOnce(restricted(suspended));
  mockPathname = "/bookings";
  rerender(app());

  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
  expect(screen.getByTestId("notice")).toHaveTextContent(suspended);
  expect(localStorage.getItem("authToken")).toBeNull();
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/auth/me",
    expect.objectContaining({ headers: { Authorization: "Bearer session-token" } })
  );
});

it("keeps the session when a navigation check cannot reach the server", async () => {
  const { rerender } = await signedInAs("bob@example.com");

  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  mockPathname = "/bookings";
  rerender(app());

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  expect(screen.getByTestId("email")).toHaveTextContent("bob@example.com");
  expect(localStorage.getItem("authToken")).toBe("session-token");
});

it("clears the reason once someone signs in again", async () => {
  localStorage.setItem("authToken", "session-token");
  fetchMock.mockResolvedValueOnce(restricted(banned));
  render(app());
  await waitFor(() => expect(screen.getByTestId("notice")).toHaveTextContent(banned));

  fetchMock.mockResolvedValueOnce(jsonResponse({ email: "alice@example.com" }));
  setAuthToken("new-token");

  await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("alice@example.com"));
  expect(screen.getByTestId("notice")).toBeEmptyDOMElement();
});

it("ignores a restriction response from an abandoned navigation", async () => {
  const { rerender } = await signedInAs("bob@example.com");
  let finish!: (response: ReturnType<typeof jsonResponse>) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  mockPathname = "/bookings";
  rerender(app());

  fetchMock.mockResolvedValueOnce(jsonResponse({ email: "bob@example.com" }));
  mockPathname = "/wallet";
  rerender(app());
  await act(async () => {
    finish(restricted(banned));
  });

  expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  expect(screen.getByTestId("notice")).toBeEmptyDOMElement();
  expect(localStorage.getItem("authToken")).toBe("session-token");
});

it("does not let an old navigation check sign out a newly logged-in account", async () => {
  const { rerender } = await signedInAs("bob@example.com");
  let finish!: (response: ReturnType<typeof jsonResponse>) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  mockPathname = "/bookings";
  rerender(app());

  fetchMock.mockResolvedValueOnce(jsonResponse({ email: "alice@example.com" }));
  act(() => setAuthToken("new-token"));
  await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("alice@example.com"));
  await act(async () => {
    finish(restricted(banned));
  });

  expect(localStorage.getItem("authToken")).toBe("new-token");
  expect(screen.getByTestId("notice")).toBeEmptyDOMElement();
});
