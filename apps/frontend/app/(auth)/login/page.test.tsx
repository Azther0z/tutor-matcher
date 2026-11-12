import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { AuthProvider } from "@/src/components/auth-provider";

const mockPush = jest.fn();
const fetchMock = jest.fn();
let nextParam: string | null = null;

jest.mock("next/navigation", () => ({
  usePathname: () => "/login",
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (key: string) => (key === "next" ? nextParam : null) }),
}));

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  nextParam = null;
  localStorage.clear();
});

function submitLogin() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "supersecret" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginPage", () => {
  it("sends a Student to the student dashboard", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "test-token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "NONE", tutor: null }) });

    render(<LoginPage />);
    submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("sends an approved Tutor straight to the Tutor dashboard", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "test-token" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "APPROVED", tutor: null }),
      });

    render(<LoginPage />);
    submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard?tab=tutor"));
  });

  it("honors an explicit ?next= redirect even for an approved Tutor", async () => {
    nextParam = "/bookings";
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: "test-token" }) });

    render(<LoginPage />);
    submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/bookings"));
    expect(fetchMock).toHaveBeenCalledTimes(1); // no tutor-status lookup needed
  });

  it("falls back to the student dashboard if the tutor-status lookup fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "test-token" }) })
      .mockRejectedValueOnce(new Error("network error"));

    render(<LoginPage />);
    submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });
  it("shows why a suspended or banned account can't log in", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: "ACCOUNT_RESTRICTED",
        message: "This account has been banned. Reason: Fraud",
      }),
    });

    render(<LoginPage />);
    submitLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account has been banned. Reason: Fraud"
    );
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("explains why an open session was ended", async () => {
    localStorage.setItem("authToken", "old-token");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: "ACCOUNT_RESTRICTED",
        message: "This account is suspended until 2 Nov 2026, 14:00 (Bangkok time). Reason: Spam",
      }),
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account is suspended until 2 Nov 2026, 14:00 (Bangkok time). Reason: Spam"
    );
    expect(localStorage.getItem("authToken")).toBeNull();
  });
});
