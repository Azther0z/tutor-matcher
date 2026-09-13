import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BookingsPage from "./page";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/bookings",
  useRouter: () => ({ replace }),
}));

const bookingId = "f0f21183-1af0-49a9-b35f-63d9431b2748";
const bookings = [
  {
    id: bookingId,
    status: "PENDING_PAYMENT",
    description: null,
    zoomMeetingUrl: null,
    createdAt: "2029-01-01T00:00:00.000Z",
    isTrial: true,
    totalAmount: "75",
    startedAt: "2099-09-11T10:00:00.000Z",
    endedAt: "2099-09-11T10:30:00.000Z",
    paymentExpiresAt: "2099-09-10T10:10:00.000Z",
    cancelledAt: null,
    cancellationReason: null,
    student: { id: "b4111412-59e8-449f-8f1a-f2fb858bd90d", name: "Student One" },
    subject: {
      id: "8f2dc6e2-27f8-4e7f-bd7f-f553e42bd05b",
      name: "Mathematics",
      hourlyRate: "150",
      tutor: { id: "aa86f069-b044-478f-b9cb-39eea6265800", name: "Alice Johnson" },
    },
    availabilities: [],
    payment: {
      status: "PENDING",
      amountDue: "75",
      walletBalance: "100",
      shortfall: "0",
      canPay: true,
      expiresAt: "2099-09-10T10:10:00.000Z",
    },
    actions: { canPay: true, canCancel: true, canReschedule: false },
  },
];

describe("bookings list", () => {
  beforeEach(() => {
    localStorage.setItem("authToken", "token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bookings }),
    }) as jest.Mock;
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("shows the student's bookings and preserves UUID detail links", async () => {
    render(<BookingsPage />);
    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Payment due" }));
    expect(screen.getByRole("link", { name: /Mathematics/ })).toHaveAttribute(
      "href",
      `/bookings/${bookingId}`
    );
  });

  it("redirects guests to login and preserves the booking-list URL", async () => {
    localStorage.clear();
    render(<BookingsPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fbookings"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
