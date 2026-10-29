import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

it("confirms wallet payment immediately without a tutor approval step", async () => {
  const pending = {
    ...booking,
    status: "PENDING_PAYMENT",
    payment: { ...booking.payment, canPay: true },
    actions: { ...booking.actions, canPay: true },
  };
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking: pending }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        booking: {
          ...booking,
          payment: { ...booking.payment, walletBalance: "0.00" },
        },
      }),
    });
  const onBalance = jest.fn();
  const unsubscribe = subscribeToWalletBalance(onBalance);
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm payment" }));
  expect(await screen.findByText("CONFIRMED")).toBeInTheDocument();
  expect(screen.getByText("Payment confirmed. Your trial lesson is booked.")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenLastCalledWith(
    `/api/bookings/${bookingId}/confirm-payment`,
    expect.objectContaining({ method: "POST" })
  );
  expect(screen.queryByRole("button", { name: "Confirm payment" })).not.toBeInTheDocument();
  expect(onBalance).toHaveBeenCalledTimes(1);
  expect(onBalance).toHaveBeenCalledWith("0.00");
  unsubscribe();
});

it("does not publish a wallet balance when payment fails", async () => {
  const pending = {
    ...booking,
    status: "PENDING_PAYMENT",
    payment: { ...booking.payment, canPay: true },
    actions: { ...booking.actions, canPay: true },
  };
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking: pending }) })
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Payment failed" }),
    });
  const onBalance = jest.fn();
  const unsubscribe = subscribeToWalletBalance(onBalance);
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm payment" }));
  expect(await screen.findByText("Payment failed")).toBeInTheDocument();
  expect(screen.queryByText("CONFIRMED")).not.toBeInTheDocument();
  expect(onBalance).not.toHaveBeenCalled();
  unsubscribe();
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

it("shows Add meeting link when the Tutor has no custom URL and validates HTTPS locally", async () => {
  const tutorBooking = {
    ...booking,
    viewerRole: "TUTOR",
    customMeetingUrl: null,
    effectiveMeetingUrl: null,
    actions: { ...booking.actions, canEditMeetingLink: true, canJoin: false },
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ booking: tutorBooking }),
  }) as jest.Mock;
  render(<BookingDetailPage />);

  expect(await screen.findByText("Add meeting link")).toBeInTheDocument();
  const input = screen.getByLabelText("Add meeting link");
  fireEvent.change(input, { target: { value: "http://meet.example.com/room" } });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Enter a valid HTTPS meeting link.");
  expect(input).toHaveValue("http://meet.example.com/room");

  const tooLongUrl = `https://meet.example.com/${"a".repeat(2048)}`;
  fireEvent.change(input, { target: { value: tooLongUrl } });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "Meeting links must be 2048 characters or fewer."
  );
  expect(input).toHaveValue(tooLongUrl);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("preserves the Tutor draft and avoids reloading after a failed meeting-link save", async () => {
  const tutorBooking = {
    ...booking,
    viewerRole: "TUTOR",
    customMeetingUrl: null,
    effectiveMeetingUrl: null,
    actions: { ...booking.actions, canEditMeetingLink: true, canJoin: false },
  };
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking: tutorBooking }) })
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Meeting link save failed" }),
    }) as jest.Mock;
  render(<BookingDetailPage />);

  const input = await screen.findByLabelText("Add meeting link");
  fireEvent.change(input, { target: { value: "https://meet.example.com/room" } });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  expect(await screen.findByText("Meeting link save failed")).toBeInTheDocument();
  expect(input).toHaveValue("https://meet.example.com/room");
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it("reloads the booking after the server says Tutor link editing is no longer allowed", async () => {
  const tutorBooking = {
    ...booking,
    viewerRole: "TUTOR",
    customMeetingUrl: "https://meet.example.com/current-room",
    effectiveMeetingUrl: "https://meet.example.com/current-room",
    actions: { ...booking.actions, canEditMeetingLink: true, canJoin: false },
  };
  const refreshedBooking = {
    ...tutorBooking,
    customMeetingUrl: null,
    effectiveMeetingUrl: null,
    actions: { ...tutorBooking.actions, canEditMeetingLink: false },
  };
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ booking: tutorBooking }) })
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ code: "MEETING_LINK_NOT_EDITABLE", message: "Booking has ended" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ booking: refreshedBooking }),
    }) as jest.Mock;
  render(<BookingDetailPage />);

  const input = await screen.findByLabelText("Replace meeting link");
  fireEvent.change(input, { target: { value: "https://meet.example.com/new-room" } });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  expect(await screen.findByText("Booking has ended")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(screen.queryByLabelText("Add meeting link")).not.toBeInTheDocument();
});

it("hides the Join action when its deadline timeout reaches the booking end", async () => {
  jest.useFakeTimers();
  try {
    const now = new Date("2030-01-10T09:29:59.000Z");
    jest.setSystemTime(now);
    const joiningBooking = {
      ...booking,
      viewerRole: "STUDENT",
      effectiveMeetingUrl: "https://meet.example.com/room",
      endedAt: "2030-01-10T09:30:01.000Z",
      actions: { ...booking.actions, canJoin: true, canEditMeetingLink: false },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ booking: joiningBooking }),
    }) as jest.Mock;
    render(<BookingDetailPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("link", { name: "Join lesson" })).toBeInTheDocument();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_001);
    });
    expect(screen.queryByRole("link", { name: "Join lesson" })).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
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

describe("BOOK-4 tutor cancellation", () => {
  const tutorBooking = {
    ...booking,
    viewerRole: "TUTOR",
    payment: { ...booking.payment, walletBalance: null, shortfall: null },
    actions: { canPay: false, canCancel: false, canReschedule: false, canTutorCancel: true },
  };
  const tutorQuote = { ...quote, refundRate: 1, refundAmount: "100", cancellationFee: "0" };

  it("warns about a late class cancellation, requires a reason and refunds the student in full", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ booking: tutorBooking }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quote: tutorQuote }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          booking: {
            ...tutorBooking,
            status: "CANCELLED",
            cancelledBy: "TUTOR",
            cancellationReason: "I am sick",
            actions: { ...tutorBooking.actions, canTutorCancel: false },
          },
          refund: { amount: "100.00", lateCancellation: true, rate: 1, cancellationFee: "0.00" },
        }),
      });
    const onBalance = jest.fn();
    const unsubscribe = subscribeToWalletBalance(onBalance);
    render(<BookingDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel class" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/within 24 hours.*Student One/);
    expect(screen.getByText("Refund to the student's wallet")).toBeInTheDocument();
    expect(screen.queryByText("Cancellation fee")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenLastCalledWith(
      `/api/bookings/${bookingId}/tutor-cancellation-quote`,
      expect.anything()
    );

    const confirm = screen.getByRole("button", { name: "Confirm cancellation" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  I am sick " } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(await screen.findByText("You cancelled this class.")).toBeInTheDocument();
    expect(screen.getByText(/Student One was refunded/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenLastCalledWith(
      `/api/bookings/${bookingId}/tutor-cancel`,
      expect.objectContaining({ body: JSON.stringify({ reason: "I am sick", quoteToken }) })
    );
    expect(onBalance).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does not show the late warning more than 24 hours before the lesson", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ booking: tutorBooking }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ quote: { ...tutorQuote, lateCancellation: false } }),
      });
    render(<BookingDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel class" }));
    expect(await screen.findByText(/class is more than 24 hours away/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tells the student their tutor cancelled and why", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        booking: {
          ...booking,
          viewerRole: "STUDENT",
          status: "CANCELLED",
          cancelledBy: "TUTOR",
          cancellationReason: "I am sick",
          actions: { canPay: false, canCancel: false, canReschedule: false, canTutorCancel: false },
        },
      }),
    });
    render(<BookingDetailPage />);
    expect(await screen.findByText("Your tutor cancelled this lesson.")).toBeInTheDocument();
    expect(screen.getByText("I am sick")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel/ })).not.toBeInTheDocument();
  });
});
