import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignupPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

function completeSignup() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "tutor@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "supersecret" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "supersecret" },
  });
  fireEvent.click(screen.getByLabelText(/I agree to the/));
}

describe("SignupPage", () => {
  it("creates an account and sends the user to login", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    render(<SignupPage />);
    completeSignup();

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tutor@example.com", password: "supersecret" }),
    });
  });

  it("keeps signup on the login flow", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "22222222-2222-4222-8222-222222222222" }),
    });
    render(<SignupPage />);
    completeSignup();

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
