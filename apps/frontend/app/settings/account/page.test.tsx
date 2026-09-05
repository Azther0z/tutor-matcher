import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountSettingsPage from "./page";

const mockReplace = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/settings/account",
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "member-token");
});

function mockAccountLoad(email = "member@example.com") {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 1, email }) });
}

async function renderLoadedPage() {
  render(<AccountSettingsPage />);
  await waitFor(() => expect(screen.getByLabelText("Email")).toHaveValue("member@example.com"));
}

describe("AccountSettingsPage", () => {
  it("loads the current email address", async () => {
    mockAccountLoad();

    await renderLoadedPage();

    expect(fetchMock).toHaveBeenCalledWith("/api/profiles/me/account", {
      headers: { Authorization: "Bearer member-token" },
      signal: expect.any(AbortSignal),
    });
  });

  it("does not send a request when nothing changed", async () => {
    mockAccountLoad();
    await renderLoadedPage();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Change your email address or your password before saving.")
    ).toBeInTheDocument();
  });

  it("highlights a malformed email instead of sending it", async () => {
    mockAccountLoad();
    await renderLoadedPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("highlights a short new password and a mismatched confirmation", async () => {
    mockAccountLoad();
    await renderLoadedPage();

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different" },
    });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("New password must be at least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("requires the current password before saving", async () => {
    mockAccountLoad();
    await renderLoadedPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Enter your current password to save changes.")).toBeInTheDocument();
  });

  it("saves a new email and stores the reissued token", async () => {
    mockAccountLoad();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ account: { id: 1, email: "new@example.com" }, token: "fresh-token" }),
    });
    await renderLoadedPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profiles/me/account", {
      method: "PUT",
      headers: {
        Authorization: "Bearer member-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "current-password" }),
    });
    expect(await screen.findByText("Account settings saved.")).toBeInTheDocument();
    expect(localStorage.getItem("authToken")).toBe("fresh-token");
  });

  it("sends only the new password when the email is unchanged", async () => {
    mockAccountLoad();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ account: { id: 1, email: "member@example.com" } }),
    });
    await renderLoadedPage();

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "a-longer-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "a-longer-password" },
    });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][1].body).toBe(
      JSON.stringify({ newPassword: "a-longer-password", currentPassword: "current-password" })
    );
    expect(
      await screen.findByText(
        "Account settings saved. Use your new password the next time you log in."
      )
    ).toBeInTheDocument();
  });

  it("highlights an email the server reports as already taken", async () => {
    mockAccountLoad();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: "A user with this email already exists" }),
    });
    await renderLoadedPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "taken@example.com" } });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findAllByText("A user with this email already exists")).not.toHaveLength(0);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("highlights an incorrect current password reported by the server", async () => {
    mockAccountLoad();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "Current password is incorrect" }),
    });
    await renderLoadedPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true")
    );
  });

  it("asks for confirmation before deactivating", async () => {
    mockAccountLoad();
    await renderLoadedPage();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate account" }));

    expect(
      screen.getByText("This will end your session immediately. Are you sure?")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep my account" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Deactivate account" })).toBeInTheDocument();
  });

  it("clears the session and returns to login after deactivating", async () => {
    mockAccountLoad();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 1 }) });
    await renderLoadedPage();

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate account" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, deactivate my account" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profiles/me/account/deactivate", {
      method: "POST",
      headers: {
        Authorization: "Bearer member-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ currentPassword: "current-password" }),
    });
    expect(localStorage.getItem("authToken")).toBeNull();
  });

  it("does not deactivate without the current password", async () => {
    mockAccountLoad();
    await renderLoadedPage();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate account" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, deactivate my account" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Enter your current password to deactivate.")).toBeInTheDocument();
    expect(localStorage.getItem("authToken")).toBe("member-token");
  });
});
