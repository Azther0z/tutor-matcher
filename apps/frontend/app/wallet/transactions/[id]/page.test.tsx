import { fireEvent, render, screen } from "@testing-library/react";
import WalletTransactionPage from "./page";

const transactionId = "22222222-2222-4222-8222-222222222222";
const bookingId = "66666666-6666-4666-8666-666666666666";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: transactionId }),
  usePathname: () => `/wallet/transactions/${transactionId}`,
  useRouter: () => ({ replace: jest.fn() }),
}));

const lessonPayment = {
  id: transactionId,
  type: "LESSON_PAYMENT",
  direction: "OUT",
  status: "COMPLETED",
  amount: "500.00",
  balanceAfter: "250.00",
  createdAt: "2026-10-11T04:00:00.000Z",
  booking: {
    id: bookingId,
    status: "CONFIRMED",
    subjectName: "Physics",
    startedAt: "2026-11-02T03:00:00.000Z",
    endedAt: "2026-11-02T04:00:00.000Z",
  },
  payoutAccount: null,
};

function respond(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe("/wallet/transactions/:id", () => {
  beforeEach(() => {
    localStorage.setItem("authToken", "user-token");
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("shows a lesson payment read-only and points payment to the booking page", async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(lessonPayment));
    render(<WalletTransactionPage />);

    expect(await screen.findByText("−฿500.00")).toBeInTheDocument();
    expect(screen.getAllByText("Lesson payment").length).toBeGreaterThan(0);
    expect(screen.getByText("฿500.00")).toBeInTheDocument();
    expect(screen.getByText("Out (from balance)")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Oct 11, 2026, 11:00 AM")).toBeInTheDocument();
    expect(screen.getByText("฿250.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Physics/ })).toHaveAttribute(
      "href",
      `/bookings/${bookingId}`
    );
    expect(
      screen.getByText(/Lesson payments are made only on the booking page/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "the booking" })).toHaveAttribute(
      "href",
      `/bookings/${bookingId}`
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(`/api/wallet/transactions/${transactionId}`, {
      headers: { Authorization: "Bearer user-token" },
    });
  });

  it("shows an incoming top-up with no related booking", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        respond({ ...lessonPayment, type: "TOP_UP", direction: "IN", booking: null })
      );
    render(<WalletTransactionPage />);
    expect(await screen.findByText("+฿500.00")).toBeInTheDocument();
    expect(screen.getByText("In (added to balance)")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.queryByText(/booking page/)).not.toBeInTheDocument();
  });

  it("shows the masked payout account for a payout", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respond({
        ...lessonPayment,
        type: "PAYOUT",
        booking: null,
        payoutAccount: {
          bankName: "Kasikornbank",
          accountHolderName: "Alice Johnson",
          maskedAccountNumber: "•••• 7890",
        },
      })
    );
    render(<WalletTransactionPage />);
    expect(await screen.findByText(/Kasikornbank/)).toHaveTextContent("Kasikornbank •••• 7890");
  });

  it("says a missing or another user's transaction was not found", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(respond({ message: "Transaction not found" }, false, 404));
    render(<WalletTransactionPage />);
    expect(
      await screen.findByText("This transaction was not found in your wallet.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("retries after a load failure", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respond({}, false, 500))
      .mockResolvedValueOnce(respond(lessonPayment));
    render(<WalletTransactionPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("−฿500.00")).toBeInTheDocument();
  });
});
