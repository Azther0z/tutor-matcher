import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./auth-provider";
import { Navbar } from "./navbar";
import { clearAuthToken, setAuthToken } from "@/src/lib/auth";
import { confirmTopup } from "@/src/lib/wallet-api";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  clearAuthToken();
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function renderNavbar() {
  return render(
    <AuthProvider>
      <Navbar />
    </AuthProvider>
  );
}

function mockAuthedUser(
  user: { firstName: string; lastName: string; email?: string },
  tutorStatus = "NONE"
) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/auth/me") {
      return Promise.resolve({ ok: true, json: async () => user });
    }
    if (url === "/api/profiles/me/tutor") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: tutorStatus, tutor: null }),
      });
    }
    if (url === "/api/wallet") {
      return Promise.resolve({ ok: true, json: async () => ({ balance: "1250.50" }) });
    }
    if (url === "/api/wallet/topups/confirm") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          balance: "1750.50",
          transaction: {
            id: "topup-1",
            type: "TOPUP",
            method: "PROMPTPAY",
            amount: "500.00",
            status: "COMPLETED",
            createdAt: "2026-10-12T00:00:00.000Z",
            completedAt: "2026-10-12T00:00:00.000Z",
          },
        }),
      });
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
}

describe("Navbar", () => {
  it("shows Login and Sign-up when the user is not authenticated", async () => {
    renderNavbar();

    expect(await screen.findByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign-up" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open account menu" })).not.toBeInTheDocument();
  });

  it("shows the balance and account menu after login", async () => {
    setAuthToken("student-token");
    mockAuthedUser({ firstName: "Mina", lastName: "Kittirat", email: "mina@example.com" });
    renderNavbar();

    const accountButton = await screen.findByRole("button", { name: "Open account menu" });
    await waitFor(() =>
      expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("฿ 1,250.50")
    );

    fireEvent.click(accountButton);

    expect(screen.getByText("Mina K.")).toBeInTheDocument();
    expect(accountButton.querySelector('img[src="/profile-circle.svg"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("updates the displayed balance as soon as a top-up is confirmed", async () => {
    setAuthToken("student-token");
    mockAuthedUser({ firstName: "Mina", lastName: "Kittirat", email: "mina@example.com" });
    renderNavbar();

    await waitFor(() =>
      expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("฿ 1,250.50")
    );

    await confirmTopup(500, "topup-1");

    await waitFor(() =>
      expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("฿ 1,750.50")
    );
  });

  it("clears the session and returns home when Logout is clicked", async () => {
    setAuthToken("student-token");
    mockAuthedUser({ firstName: "Mina", lastName: "Kittirat" });
    renderNavbar();

    fireEvent.click(await screen.findByRole("button", { name: "Open account menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument());
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("shows Become a tutor for a logged-out visitor", async () => {
    renderNavbar();

    expect(await screen.findByRole("link", { name: "Become a tutor" })).toBeInTheDocument();
  });

  it("shows Become a tutor for a logged-in user who is not an approved Tutor", async () => {
    setAuthToken("student-token");
    mockAuthedUser({ firstName: "Mina", lastName: "Kittirat" }, "NONE");
    renderNavbar();

    await screen.findByRole("button", { name: "Open account menu" });
    expect(screen.getByRole("link", { name: "Become a tutor" })).toBeInTheDocument();
  });

  it("hides Become a tutor for an approved Tutor", async () => {
    setAuthToken("tutor-token");
    mockAuthedUser({ firstName: "Ada", lastName: "Lovelace" }, "APPROVED");
    renderNavbar();

    await screen.findByRole("button", { name: "Open account menu" });
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Become a tutor" })).not.toBeInTheDocument()
    );
  });
});
