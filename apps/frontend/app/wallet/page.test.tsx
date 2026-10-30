import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { subscribeToWalletBalance } from "@/src/lib/wallet-api";
import WalletPage from "./page";

const replace = jest.fn();
let mockParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  usePathname: () => "/wallet",
  useRouter: () => ({ replace }),
  useSearchParams: () => mockParams,
}));

const bookingId = "66666666-6666-4666-8666-666666666666";
const booking = {
  id: bookingId,
  status: "CONFIRMED",
  subjectName: "Physics",
  startedAt: "2026-11-02T03:00:00.000Z",
  endedAt: "2026-11-02T04:00:00.000Z",
};

function transaction(id: string, type: string, direction: "IN" | "OUT", extra: object = {}) {
  return {
    id,
    type,
    direction,
    status: "COMPLETED",
    amount: "500.00",
    balanceAfter: "750.00",
    createdAt: "2026-10-11T04:00:00.000Z",
    booking: null,
    payoutAccount: null,
    ...extra,
  };
}

const allTransactions = [
  transaction("t-payout", "PAYOUT", "OUT"),
  transaction("t-refund", "REFUND", "IN", { booking }),
  transaction("t-earning", "LESSON_EARNING", "IN", { booking }),
  transaction("t-payment", "LESSON_PAYMENT", "OUT", { booking }),
  transaction("t-topup", "TOP_UP", "IN"),
];

const tutorOverview = {
  balance: "1200.00",
  isTutor: true,
  pendingEarnings: "708.33",
  earningsThisMonth: "425.00",
  totalPaidOut: "300.00",
  paymentDue: [],
};

function respond(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

type MockApiOptions = {
  overview?: object;
  transactions?: object[];
  total?: number;
  overviewOk?: boolean;
  listOk?: boolean;
};

function mockApi({
  overview = tutorOverview,
  transactions = allTransactions,
  total = transactions.length,
  overviewOk = true,
  listOk = true,
}: MockApiOptions = {}) {
  global.fetch = jest.fn(async (url: string) => {
    if (url === "/api/wallet/overview")
      return respond(overview, overviewOk, overviewOk ? 200 : 500);
    return respond({ transactions, page: 1, pageSize: 20, total }, listOk, listOk ? 200 : 500);
  }) as unknown as typeof fetch;
}

describe("/wallet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = new URLSearchParams();
    localStorage.setItem("authToken", "user-token");
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("shows one balance with Tutor summaries and publishes it to the navbar", async () => {
    mockApi();
    const published: string[] = [];
    const unsubscribe = subscribeToWalletBalance((balance) => published.push(balance));

    render(<WalletPage />);
    const summary = await screen.findByRole("region", { name: "Wallet summary" });
    await waitFor(() => expect(within(summary).getByText("฿1,200.00")).toBeInTheDocument());
    expect(within(summary).getAllByText("Available balance")).toHaveLength(1);
    expect(within(summary).getByText("฿708.33")).toBeInTheDocument();
    expect(within(summary).getByText(/after the 15% platform fee/)).toBeInTheDocument();
    expect(within(summary).getByText("฿425.00")).toBeInTheDocument();
    expect(within(summary).getByText("฿300.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request payout" })).toHaveAttribute(
      "href",
      "/wallet/payout"
    );
    expect(published).toEqual(["1200.00"]);
    unsubscribe();
  });

  it("hides pending earnings and payout for a user who is not a Tutor", async () => {
    mockApi({ overview: { ...tutorOverview, isTutor: false, pendingEarnings: null } });
    render(<WalletPage />);
    expect(await screen.findByText("฿1,200.00")).toBeInTheDocument();
    expect(screen.queryByText("Pending earnings")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request payout" })).not.toBeInTheDocument();
  });

  it("lists every type in one list, signed by direction, each opening its detail", async () => {
    mockApi();
    render(<WalletPage />);
    const rows = await screen.findAllByRole("link", { name: /Balance ฿750\.00/ });
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/wallet/transactions/t-payout",
      "/wallet/transactions/t-refund",
      "/wallet/transactions/t-earning",
      "/wallet/transactions/t-payment",
      "/wallet/transactions/t-topup",
    ]);
    expect(within(rows[0]!).getByText("Payout")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("−฿500.00")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Refund")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("+฿500.00")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Lesson earning")).toBeInTheDocument();
    expect(within(rows[3]!).getByText("Lesson payment")).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/Physics/)).toBeInTheDocument();
    expect(within(rows[4]!).getByText("Top-up")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/wallet/transactions?page=1",
      expect.objectContaining({ headers: { Authorization: "Bearer user-token" } })
    );
  });

  it("keeps the filter in the URL and requests only that type", async () => {
    mockApi();
    const { unmount } = render(<WalletPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Refunds" }));
    expect(replace).toHaveBeenCalledWith("/wallet?type=REFUND");
    unmount();

    mockParams = new URLSearchParams("type=REFUND");
    mockApi({ transactions: [] });
    render(<WalletPage />);
    expect(await screen.findByText("No refunds yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refunds" })).toHaveAttribute("aria-pressed", "true");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/wallet/transactions?page=1&type=REFUND",
      expect.anything()
    );
  });

  it("ignores an unknown filter in the URL", async () => {
    mockParams = new URLSearchParams("type=EARNING");
    mockApi();
    render(<WalletPage />);
    await screen.findAllByRole("link", { name: /Balance ฿750\.00/ });
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it("pages through the list", async () => {
    mockParams = new URLSearchParams("type=TOP_UP&page=2");
    mockApi({ total: 45 });
    render(<WalletPage />);
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(replace).toHaveBeenCalledWith("/wallet?type=TOP_UP&page=3");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(replace).toHaveBeenCalledWith("/wallet?type=TOP_UP");
  });

  it("sends unpaid bookings to their booking page instead of taking payment", async () => {
    mockApi({
      overview: {
        ...tutorOverview,
        paymentDue: [
          {
            bookingId,
            subjectName: "Algebra",
            amount: "250.00",
            startedAt: "2026-11-02T03:00:00.000Z",
            paymentExpiresAt: "2026-10-30T04:15:00.000Z",
          },
        ],
      },
    });
    render(<WalletPage />);
    const notice = await screen.findByRole("region", { name: "Payment due" });
    expect(within(notice).getByText("Algebra")).toBeInTheDocument();
    expect(within(notice).getByRole("link", { name: "Pay on booking page" })).toHaveAttribute(
      "href",
      `/bookings/${bookingId}`
    );
    expect(screen.queryByRole("button", { name: /^Pay\b/ })).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mockApi({ transactions: [] });
    render(<WalletPage />);
    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
  });

  it("retries after the list and the balance fail to load", async () => {
    mockApi({ overviewOk: false, listOk: false });
    render(<WalletPage />);
    expect(await screen.findByText("Could not load your transactions.")).toBeInTheDocument();
    expect(await screen.findByText("Could not load your wallet balance.")).toBeInTheDocument();

    mockApi();
    for (const button of screen.getAllByRole("button", { name: "Try again" })) {
      fireEvent.click(button);
    }
    expect(await screen.findByText("฿1,200.00")).toBeInTheDocument();
    expect(await screen.findAllByRole("link", { name: /Balance ฿750\.00/ })).toHaveLength(5);
  });
});
