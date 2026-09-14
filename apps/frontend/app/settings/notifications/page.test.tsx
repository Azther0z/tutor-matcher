import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NotificationSettingsPage from "./page";

const mockReplace = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/settings/notifications",
  useRouter: () => ({ push: mockReplace, replace: mockReplace }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "test-token");
});

function mockPreferences(body: unknown) {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
}

describe("NotificationSettingsPage", () => {
  it("loads and displays the member's current preferences", async () => {
    mockPreferences({ notifyOnBooking: true, notifyOnMessage: false, notifyOnPayment: true });
    render(<NotificationSettingsPage />);

    expect(await screen.findByRole("checkbox", { name: /Bookings/ })).toBeChecked();
    expect(screen.getByRole("heading", { name: "Notification settings" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Messages/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Payments/ })).toBeChecked();
  });

  it("shows an error when preferences cannot be loaded", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<NotificationSettingsPage />);

    expect(
      await screen.findByText(
        "We could not load your notification preferences. Please refresh and try again."
      )
    ).toBeInTheDocument();
  });

  it("saves the toggled preferences", async () => {
    mockPreferences({ notifyOnBooking: true, notifyOnMessage: true, notifyOnPayment: true });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ notifyOnBooking: false, notifyOnMessage: true, notifyOnPayment: true }),
    });
    render(<NotificationSettingsPage />);

    await screen.findByRole("checkbox", { name: /Bookings/ });
    fireEvent.click(screen.getByRole("checkbox", { name: /Bookings/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/notifications/preferences", {
      method: "PUT",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notifyOnBooking: false,
        notifyOnMessage: true,
        notifyOnPayment: true,
      }),
    });
    expect(await screen.findByText("Notification preferences saved.")).toBeInTheDocument();
  });

  it("shows an error message when saving fails", async () => {
    mockPreferences({ notifyOnBooking: true, notifyOnMessage: true, notifyOnPayment: true });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Could not save your notification preferences." }),
    });
    render(<NotificationSettingsPage />);

    await screen.findByRole("checkbox", { name: /Bookings/ });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(
      await screen.findByText("Could not save your notification preferences.")
    ).toBeInTheDocument();
  });
});
