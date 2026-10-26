import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SubjectBookingPage from "./page";

const subjectId = "8f2dc6e2-27f8-4e7f-bd7f-f553e42bd05b";
const bookingId = "f0f21183-1af0-49a9-b35f-63d9431b2748";
const slotId = "073ea12c-9fb1-4c70-9910-554432c8dc21";
const push = jest.fn();
const replace = jest.fn();
const router = { push, replace };
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useParams: () => ({ subjectId }),
  usePathname: () => `/bookings/s/${subjectId}`,
  useRouter: () => router,
  useSearchParams: () => mockSearchParams,
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
  jest.useFakeTimers({
    now: new Date("2030-01-01T00:00:00Z"),
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask"],
  });
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  localStorage.setItem("authToken", "student-token");
});

afterEach(() => {
  localStorage.clear();
  jest.useRealTimers();
});

it("opens the date passed by DISC-4 without selecting times or creating a booking", async () => {
  mockSearchParams = new URLSearchParams({ date: "2030-01-10" });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => availability });
  render(<SubjectBookingPage />);
  expect(await screen.findByRole("button", { name: "2030-01-10" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(screen.getByRole("button", { name: "16:00 Available" })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  expect(screen.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(push).not.toHaveBeenCalled();
});

it("creates a trial booking with UUID identifiers", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => availability })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking: { id: bookingId } }) });
  render(<SubjectBookingPage />);
  fireEvent.click(await screen.findByRole("button", { name: "2030-01-10" }));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("button", { name: /^\d{2}:\d{2} / })).toHaveLength(48);
  expect(screen.getByRole("button", { name: "00:00 Not available" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "23:30 Not available" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "16:00 Available" }));
  expect(screen.getByText("Trial · 30 min")).toBeInTheDocument();
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
  fireEvent.click(await screen.findByRole("button", { name: "2030-01-10" }));
  fireEvent.click(screen.getByRole("button", { name: "16:00 Available" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
  expect(await screen.findByText(/just booked by someone else/i)).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
});

it("calculates a continuous hour from the locked subject rate without creating a booking", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      ...availability,
      slots: [
        ...availability.slots,
        { id: "second", startedAt: "2030-01-10T09:30:00Z", available: true },
      ],
    }),
  });
  render(<SubjectBookingPage />);
  fireEvent.click(await screen.findByRole("button", { name: "2030-01-10" }));
  fireEvent.click(screen.getByRole("button", { name: "16:00 Available" }));
  expect(screen.getByText("฿10.00")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "16:30 Available" }));
  expect(screen.getByText("Trial · 60 min")).toBeInTheDocument();
  expect(screen.getByText("฿20.00")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(push).not.toHaveBeenCalled();
});

it("keeps subject details visible but disables new bookings when unpublished", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ...availability, acceptingBookings: false, slots: [] }),
  });
  render(<SubjectBookingPage />);
  expect(await screen.findByText("This tutor isn’t accepting bookings")).toBeInTheDocument();
  expect(screen.getByText("English with Alice")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
});

it("keeps certificates and ID references out of the subject booking UI", async () => {
  const certificates = ["http://example.com/contest.pdf", "https://example.com/teaching.pdf"];
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      ...availability,
      subject: {
        ...availability.subject,
        tutor: {
          ...availability.subject.tutor,
          certificationUrls: certificates,
          identificationCardUrl: "https://example.com/id-private",
        },
      },
    }),
  });
  render(<SubjectBookingPage />);
  expect(await screen.findByText("English with Alice")).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Teaching certifications / portfolio" })
  ).not.toBeInTheDocument();
  for (const url of certificates) expect(screen.queryByText(url)).not.toBeInTheDocument();
  expect(screen.queryByText("https://example.com/id-private")).not.toBeInTheDocument();
});
