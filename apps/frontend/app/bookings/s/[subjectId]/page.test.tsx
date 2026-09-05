import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SubjectBookingPage from "./page";

const push = jest.fn();
const replace = jest.fn();
const router = { push, replace };
jest.mock("next/navigation", () => ({
  useParams: () => ({ subjectId: "12" }),
  useRouter: () => router,
}));

const availability = {
  subject: { id: 12, name: "English", hourlyRate: 20, tutor: { id: 3, name: "Alice" } },
  slots: [{ id: 101, startedAt: "2030-01-10T09:00:00.000Z", available: true }],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("authToken", "student-token");
});

it("creates a trial booking from the selected slot", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => availability })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 44 }) });
  render(<SubjectBookingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /(?:AM|PM)/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/bookings/44"));
  expect(global.fetch).toHaveBeenLastCalledWith(
    "/api/bookings",
    expect.objectContaining({ method: "POST" })
  );
});

it("refreshes availability when another student takes the slot", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => availability })
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: "Slot taken" }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...availability, slots: [] }) });
  render(<SubjectBookingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /(?:AM|PM)/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
  expect(await screen.findByText(/just booked by someone else/i)).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
});
