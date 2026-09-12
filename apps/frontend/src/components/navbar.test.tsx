import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./auth-provider";
import { Navbar } from "./navbar";
import { clearAuthToken, setAuthToken } from "@/src/lib/auth";

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
    expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("฿ 0");

    fireEvent.click(accountButton);

    expect(screen.getByText("Mina K.")).toBeInTheDocument();
    expect(accountButton).toHaveTextContent("M");
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
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
