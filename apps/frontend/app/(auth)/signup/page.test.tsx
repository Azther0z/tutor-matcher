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

function completeSignup({ tutor }: { tutor: boolean }) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "tutor@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "supersecret" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "supersecret" },
  });
  if (tutor) fireEvent.click(screen.getByLabelText("Are you a tutor?"));
  fireEvent.click(screen.getByLabelText(/I agree to the/));
}

describe("SignupPage", () => {
  it("signs a new Tutor in and opens the Tutor profile immediately", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "tutor-token" }) });
    render(<SignupPage />);
    completeSignup({ tutor: true });

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/settings/tutor"));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tutor@example.com", password: "supersecret" }),
    });
    expect(localStorage.getItem("authToken")).toBe("tutor-token");
  });

  it("keeps Student signup on the login flow", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 2 }) });
    render(<SignupPage />);
    completeSignup({ tutor: false });

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
