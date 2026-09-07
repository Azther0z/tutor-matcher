import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "./page";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

describe("ForgotPasswordPage", () => {
  it("shows a generic success state after requesting a reset", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "If an account exists for that email, we sent a password reset link.",
      }),
    });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Check your email" })).toBeVisible()
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" }),
    });
  });

  it("shows request errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Invalid request" }),
    });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter a valid email address."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
