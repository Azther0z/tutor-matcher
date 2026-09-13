import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResetPasswordPage from "./page";

const fetchMock = jest.fn();
const token = "raw-token";

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (name: string) => (name === "token" ? token : null) }),
}));

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

describe("ResetPasswordPage", () => {
  it("shows a new-token link when validation fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "This password reset link is invalid or has expired" }),
    });
    render(<ResetPasswordPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/password-reset/validate?token=raw-token");
  });

  it("validates the token and catches mismatched passwords", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ valid: true }) });
    render(<ResetPasswordPage />);
    await screen.findByLabelText("New password");

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpassword" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resets successfully and offers navigation back to login", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ valid: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Your password has been reset successfully." }),
      });
    render(<ResetPasswordPage />);
    await screen.findByLabelText("New password");

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpassword" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Password reset" })).toBeVisible()
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "newpassword" }),
    });
    expect(screen.getByRole("link", { name: "Return to log in" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
