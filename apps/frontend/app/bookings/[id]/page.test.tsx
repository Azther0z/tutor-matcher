import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BookingDetailPage from "./page";
import { subscribeToWalletBalance } from "@/src/lib/wallet-api";

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
    status: "COMPLETED",
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
      json: async () => ({
        booking: {
          ...booking,
          status: "CANCELLED",
          actions: { canCancel: false, canPay: false, canReschedule: false },
          payment: { ...booking.payment, walletBalance: "320.00" },
        },
        refund: { amount: "70.00", lateCancellation: true, rate: 0.7, cancellationFee: "30.00" },
      }),
    });
  const onBalance = jest.fn();
  const unsubscribe = subscribeToWalletBalance(onBalance);
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  expect(await screen.findByText(/30\.00/)).toBeInTheDocument();
  expect(screen.getByText(/70\.00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await waitFor(() => expect(screen.getByText("CANCELLED")).toBeInTheDocument());
  expect(screen.getByText(/70.00.*returned to your wallet/)).toBeInTheDocument();
  expect(onBalance).toHaveBeenCalledWith("320.00");
  unsubscribe();
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
  expect(global.fetch).toHaveBeenCalledTimes(3);
});

it("keeps confirmation disabled until a failed quote is retried", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking }) })
    .mockRejectedValueOnce(new Error("Terms are temporarily unavailable"))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ quote }) });
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  await screen.findByText("Terms are temporarily unavailable");
  expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeDisabled();
  expect(global.fetch).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Retry cancellation terms" }));
  await screen.findByText(/70\.00/);
  expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeEnabled();
});

it("discards a stale quote when reloading its replacement fails", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ quote }) })
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ code: "CANCELLATION_QUOTE_CHANGED", message: "Quote changed" }),
    })
    .mockRejectedValueOnce(new Error("Could not reload current terms"));
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  await screen.findByText(/70\.00/);
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await screen.findByText("Could not reload current terms");
  expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeDisabled();
  expect(screen.queryByText(/70\.00/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry cancellation terms" })).toBeEnabled();
  expect(global.fetch).toHaveBeenCalledTimes(4);
});

it("does not submit cancellation when the student chooses to keep the lesson", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ quote }) });
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  await screen.findByText(/70\.00/);
  expect(screen.getByRole("textbox", { name: /Reason/ })).toHaveAttribute("maxLength", "500");
  fireEvent.click(screen.getByRole("button", { name: "Keep lesson" }));
  expect(screen.queryByRole("button", { name: "Confirm cancellation" })).not.toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it("ignores an old quote response after closing and reopening cancellation", async () => {
  let resolveOldQuote!: (response: unknown) => void;
  const oldRequest = new Promise((resolve) => {
    resolveOldQuote = resolve;
  });
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking }) })
    .mockReturnValueOnce(oldRequest)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quote: { ...quote, refundAmount: "60", cancellationFee: "40" } }),
    });
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep lesson" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel lesson" }));
  await screen.findByText(/60\.00/);
  resolveOldQuote({ ok: true, json: async () => ({ quote }) });
  await waitFor(() => expect(screen.queryByText(/70\.00/)).not.toBeInTheDocument());
  expect(screen.getByText(/60\.00/)).toBeInTheDocument();
});

it("blocks duplicate cancellation and competing actions while a request is pending", async () => {
  let resolveCancellation!: (response: unknown) => void;
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ quote }) })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCancellation = resolve;
        })
    );
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  await screen.findByText(/70\.00/);
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  const pending = screen.getByRole("button", { name: "Cancelling…" });
  expect(pending).toBeDisabled();
  expect(screen.getByRole("button", { name: "Keep lesson" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel lesson" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reschedule" })).toBeDisabled();
  fireEvent.click(pending);
  expect(global.fetch).toHaveBeenCalledTimes(3);
  resolveCancellation({
    ok: false,
    status: 500,
    json: async () => ({ message: "Try again later" }),
  });
  await screen.findByText("Try again later");
  expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeEnabled();
});

it("does not claim a refund for an unpaid cancellation", async () => {
  const unpaidQuote = {
    ...quote,
    originalAmount: "0",
    refundAmount: "0",
    refundRate: 0,
    cancellationFee: "0",
  };
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ booking: { ...booking, status: "PENDING_PAYMENT" } }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ quote: unpaidQuote }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        booking: {
          ...booking,
          status: "CANCELLED",
          actions: { canPay: false, canCancel: false, canReschedule: false },
        },
        refund: { amount: "0", lateCancellation: true, rate: 0, cancellationFee: "0" },
      }),
    });
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  await screen.findByText("Refund rate");
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await screen.findByText("Booking cancelled. No wallet refund was due.");
});
