import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SubjectBookingPage from "./page";

const subjectId = "8f2dc6e2-27f8-4e7f-bd7f-f553e42bd05b";
const bookingId = "f0f21183-1af0-49a9-b35f-63d9431b2748";
const slotId = "073ea12c-9fb1-4c70-9910-554432c8dc21";
const push = jest.fn();
const replace = jest.fn();
const router = { push, replace };

jest.mock("next/navigation", () => ({
  useParams: () => ({ subjectId }),
  usePathname: () => `/bookings/s/${subjectId}`,
  useRouter: () => router,
}));

const availability = {
  subject: {
    id: subjectId,
    name: "English",
    hourlyRate: "20",
    tutor: { id: "aa86f069-b044-478f-b9cb-39eea6265800", name: "Alice" },
  },
  slots: [{ id: slotId, startedAt: "2030-01-10T09:00:00.000Z", available: true }],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("authToken", "student-token");
});

afterEach(() => localStorage.clear());

it("creates a trial booking with UUID identifiers", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => availability })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking: { id: bookingId } }) });
  render(<SubjectBookingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /(?:AM|PM)/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith(`/bookings/${bookingId}`));
  expect(global.fetch).toHaveBeenLastCalledWith(
    "/api/bookings",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        subjectId,
        availabilityIds: [slotId],
        isTrial: true,
      }),
    })
  );
});

it("refreshes availability only for a structured slot-taken error", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => availability })
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ code: "SLOT_TAKEN", message: "Slot taken" }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...availability, slots: [] }) });
  render(<SubjectBookingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /(?:AM|PM)/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
  expect(await screen.findByText(/just booked by someone else/i)).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
});
