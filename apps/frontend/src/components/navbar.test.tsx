import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./auth-provider";
import { Navbar } from "./navbar";
import { clearAuthToken, setAuthToken } from "@/src/lib/auth";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  clearAuthToken();
  mockPush.mockReset();
  global.fetch = jest.fn();
});

function renderNavbar() {
  return render(
    <AuthProvider>
      <Navbar />
    </AuthProvider>
  );
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
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        firstName: "Mina",
        lastName: "Kittirat",
        email: "mina@example.com",
      }),
    });
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
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ firstName: "Mina", lastName: "Kittirat" }),
    });
    renderNavbar();

    fireEvent.click(await screen.findByRole("button", { name: "Open account menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument());
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/");
  });
});
