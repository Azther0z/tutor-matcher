import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function mockAccountLoad(email = "member@example.com", firstName = "Ada", lastName = "Lovelace") {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ id: 1, email, firstName, lastName }),
  });
}

async function renderLoadedPage() {
  render(<AccountSettingsPage />);
  await waitFor(() => expect(screen.getByLabelText("Email")).toHaveValue("member@example.com"));
}

describe("AccountSettingsPage", () => {
  it("shows a sidebar with Account active and Student profile available", async () => {
    mockAccountLoad();
    await renderLoadedPage();

    const link = screen.getByRole("link", { name: "Account" });
    expect(link).toHaveAttribute("href", "/settings/account");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Student profile" })).toHaveAttribute(
      "href",
      "/settings/student"
    );
  });

  it("loads the current email address", async () => {
    mockAccountLoad();

    await renderLoadedPage();

    expect(fetchMock).toHaveBeenCalledWith("/api/profiles/me/account", {
      headers: { Authorization: "Bearer member-token" },
      signal: expect.any(AbortSignal),
    });
  });

  describe("name block", () => {
    it("prefills the current first and last name", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      expect(screen.getByLabelText("First name")).toHaveValue("Ada");
      expect(screen.getByLabelText("Last name")).toHaveValue("Lovelace");
    });

    it("does not send a request when the name is unchanged", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.click(screen.getByRole("button", { name: "Save name" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await screen.findByText("Change your name before saving.")).toBeInTheDocument();
    });

    it("requires both first and last name when only one is provided", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Grace" } });
      fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Last name is required.")).toBeInTheDocument();
      expect(screen.getByLabelText("Last name")).toHaveAttribute("aria-invalid", "true");
    });

    it("requires the current password before saving", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Grace" } });
      fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Hopper" } });
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Enter your current password to save changes.")).toBeInTheDocument();
    });

    it("saves a new name and stores the reissued token", async () => {
      mockAccountLoad();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          account: { id: 1, firstName: "Grace", lastName: "Hopper" },
          token: "fresh-token",
        }),
      });
      await renderLoadedPage();

      const nameSection = screen.getByRole("heading", { name: "Name" }).closest("form")!;

      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Grace" } });
      fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Hopper" } });
      fireEvent.change(within(nameSection).getByLabelText("Current password"), {
        target: { value: "current-password" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profiles/me/account", {
        method: "PUT",
        headers: {
          Authorization: "Bearer member-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "Grace",
          lastName: "Hopper",
          currentPassword: "current-password",
        }),
      });
      expect(await screen.findByText("Name saved.")).toBeInTheDocument();
      expect(localStorage.getItem("authToken")).toBe("fresh-token");
    });

    it("highlights an incorrect current password reported by the server", async () => {
      mockAccountLoad();
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: "Current password is incorrect" }),
      });
      await renderLoadedPage();

      const nameSection = screen.getByRole("heading", { name: "Name" }).closest("form")!;

      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Grace" } });
      fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Hopper" } });
      fireEvent.change(within(nameSection).getByLabelText("Current password"), {
        target: { value: "wrong" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));

      await waitFor(() =>
        expect(within(nameSection).getByLabelText("Current password")).toHaveAttribute(
          "aria-invalid",
          "true"
        )
      );
    });
  });

  describe("email block", () => {
    it("does not send a request when the email is unchanged", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.click(screen.getByRole("button", { name: "Save email" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(
        await screen.findByText("Change your email address before saving.")
      ).toBeInTheDocument();
    });

    it("highlights a malformed email instead of sending it", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
      fireEvent.click(screen.getByRole("button", { name: "Save email" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    });

    it("requires the current password before saving", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Save email" }));

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

      const emailSection = screen.getByRole("heading", { name: "Email address" }).closest("form")!;

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
      fireEvent.change(within(emailSection).getByLabelText("Current password"), {
        target: { value: "current-password" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save email" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profiles/me/account", {
        method: "PUT",
        headers: {
          Authorization: "Bearer member-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "new@example.com", currentPassword: "current-password" }),
      });
      expect(await screen.findByText("Email address saved.")).toBeInTheDocument();
      expect(localStorage.getItem("authToken")).toBe("fresh-token");
    });

    it("highlights an email the server reports as already taken", async () => {
      mockAccountLoad();
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: "A user with this email already exists" }),
      });
      await renderLoadedPage();

      const emailSection = screen.getByRole("heading", { name: "Email address" }).closest("form")!;

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "taken@example.com" } });
      fireEvent.change(within(emailSection).getByLabelText("Current password"), {
        target: { value: "current-password" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save email" }));

      expect(await screen.findAllByText("A user with this email already exists")).not.toHaveLength(
        0
      );
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

      const emailSection = screen.getByRole("heading", { name: "Email address" }).closest("form")!;

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
      fireEvent.change(within(emailSection).getByLabelText("Current password"), {
        target: { value: "wrong" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save email" }));

      await waitFor(() =>
        expect(within(emailSection).getByLabelText("Current password")).toHaveAttribute(
          "aria-invalid",
          "true"
        )
      );
    });
  });

  describe("password block", () => {
    it("does not send a request when neither password field is filled", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.click(screen.getByRole("button", { name: "Save password" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await screen.findByText("Enter a new password before saving.")).toBeInTheDocument();
    });

    it("highlights a short new password and a mismatched confirmation", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
      fireEvent.change(screen.getByLabelText("Confirm new password"), {
        target: { value: "different" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save password" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("New password must be at least 8 characters.")).toBeInTheDocument();
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    });

    it("requires the current password before saving", async () => {
      mockAccountLoad();
      await renderLoadedPage();

      fireEvent.change(screen.getByLabelText("New password"), {
        target: { value: "a-longer-password" },
      });
      fireEvent.change(screen.getByLabelText("Confirm new password"), {
        target: { value: "a-longer-password" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save password" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Enter your current password to save changes.")).toBeInTheDocument();
    });

    it("saves a new password and stores the reissued token", async () => {
      mockAccountLoad();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "fresh-token" }),
      });
      await renderLoadedPage();

      const passwordSection = screen.getByRole("heading", { name: "Password" }).closest("form")!;

      fireEvent.change(screen.getByLabelText("New password"), {
        target: { value: "a-longer-password" },
      });
      fireEvent.change(screen.getByLabelText("Confirm new password"), {
        target: { value: "a-longer-password" },
      });
      fireEvent.change(within(passwordSection).getByLabelText("Current password"), {
        target: { value: "current-password" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save password" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(fetchMock.mock.calls[1][1].body).toBe(
        JSON.stringify({
          newPassword: "a-longer-password",
          currentPassword: "current-password",
        })
      );
      expect(
        await screen.findByText("Password saved. Use it the next time you log in.")
      ).toBeInTheDocument();
      expect(localStorage.getItem("authToken")).toBe("fresh-token");
    });

    it("highlights an incorrect current password reported by the server", async () => {
      mockAccountLoad();
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: "Current password is incorrect" }),
      });
      await renderLoadedPage();

      const passwordSection = screen.getByRole("heading", { name: "Password" }).closest("form")!;

      fireEvent.change(screen.getByLabelText("New password"), {
        target: { value: "a-longer-password" },
      });
      fireEvent.change(screen.getByLabelText("Confirm new password"), {
        target: { value: "a-longer-password" },
      });
      fireEvent.change(within(passwordSection).getByLabelText("Current password"), {
        target: { value: "wrong" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save password" }));

      await waitFor(() =>
        expect(within(passwordSection).getByLabelText("Current password")).toHaveAttribute(
          "aria-invalid",
          "true"
        )
      );
    });
  });
});
