import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BookingDetailPage from "./page";

const bookingId = "f0f21183-1af0-49a9-b35f-63d9431b2748";
const quoteToken = "a".repeat(64);
const changedQuoteToken = "b".repeat(64);
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: bookingId }),
  usePathname: () => `/bookings/${bookingId}`,
  useRouter: () => ({ replace }),
}));

const booking = {
  id: bookingId,
  status: "CONFIRMED",
  description: null,
  zoomMeetingUrl: null,
  createdAt: "2029-01-01T00:00:00.000Z",
  isTrial: true,
  totalAmount: "100",
  startedAt: "2030-01-10T09:00:00.000Z",
  endedAt: "2030-01-10T09:30:00.000Z",
  paymentExpiresAt: null,
  cancelledAt: null,
  cancellationReason: null,
  student: { id: "b4111412-59e8-449f-8f1a-f2fb858bd90d", name: "Student One" },
  subject: {
    id: "8f2dc6e2-27f8-4e7f-bd7f-f553e42bd05b",
    name: "English",
    description: null,
    hourlyRate: "200",
    tutor: { id: "aa86f069-b044-478f-b9cb-39eea6265800", name: "Alice" },
  },
  availabilities: [
    { id: "073ea12c-9fb1-4c70-9910-554432c8dc21", startedAt: "2030-01-10T09:00:00.000Z" },
  ],
  payment: {
    status: "HOLDING",
    amountDue: "100",
    walletBalance: "250",
    shortfall: "0",
    canPay: false,
    expiresAt: null,
  },
  actions: { canPay: false, canCancel: true, canReschedule: true },
};

const quote = {
  token: quoteToken,
  generatedAt: "2029-01-01T00:00:00.000Z",
  bookingId,
  lateCancellation: true,
  policyWindowHours: 24,
  refundRate: 0.7,
  originalAmount: "100",
  refundAmount: "70",
  cancellationFee: "30",
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("authToken", "student-token");
});

afterEach(() => localStorage.clear());

it("shows server cancellation terms before sending the quote token", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ quote }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ booking: { ...booking, status: "CANCELLED" } }),
    });
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  expect(await screen.findByText(/30\.00/)).toBeInTheDocument();
  expect(screen.getByText(/70\.00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await waitFor(() => expect(screen.getByText("CANCELLED")).toBeInTheDocument());
  expect(global.fetch).toHaveBeenLastCalledWith(
    `/api/bookings/${bookingId}/cancel`,
    expect.objectContaining({
      body: JSON.stringify({ quoteToken }),
    })
  );
});

it("disables payment and links to wallet top-up for the server shortfall", async () => {
  const insufficient = {
    ...booking,
    status: "PENDING_PAYMENT",
    paymentExpiresAt: "2029-01-01T00:10:00.000Z",
    payment: {
      status: "PENDING",
      amountDue: "100",
      walletBalance: "50",
      shortfall: "50",
      canPay: false,
      expiresAt: "2029-01-01T00:10:00.000Z",
    },
    actions: { canPay: false, canCancel: true, canReschedule: false },
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ booking: insufficient }),
  }) as jest.Mock;
  render(<BookingDetailPage />);
  expect(await screen.findByRole("button", { name: "Confirm payment" })).toBeDisabled();
  expect(screen.getByRole("link", { name: /Top up/ })).toHaveAttribute(
    "href",
    `/wallet/topup?amount=50&returnTo=%2Fbookings%2F${bookingId}`
  );
});

it("does not show student actions when the backend denies them", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      booking: { ...booking, actions: { canPay: false, canCancel: false, canReschedule: false } },
    }),
  }) as jest.Mock;
  render(<BookingDetailPage />);
  expect(await screen.findByText("Alice")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancel lesson" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
});

it("requires a second confirmation when the server quote changes", async () => {
  const currentQuote = {
    ...quote,
    token: changedQuoteToken,
    refundAmount: "60",
    cancellationFee: "40",
  };
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ quote }) })
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        code: "CANCELLATION_QUOTE_CHANGED",
        message: "Quote changed",
        details: { currentQuote },
      }),
    });
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  await screen.findByText(/70\.00/);
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  expect(await screen.findByText(/terms changed/i)).toBeInTheDocument();
  expect(screen.getByText(/60\.00/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeEnabled();
});
