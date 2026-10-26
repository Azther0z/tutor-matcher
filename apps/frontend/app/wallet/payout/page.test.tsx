import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { subscribeToWalletBalance } from "@/src/lib/wallet-api";
import WalletPayoutPage from "./page";

const replace = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/wallet/payout",
  useRouter: () => ({ replace }),
}));

const reference = "22222222-2222-4222-8222-222222222222";
const defaultAccount = {
  id: "account-default",
  bankCode: "KBANK",
  bankName: "Kasikornbank",
  accountHolderName: "Alice Johnson",
  maskedAccountNumber: "•••• 7890",
  isDefault: true,
  createdAt: "2026-10-20T04:00:00.000Z",
};
const otherAccount = {
  ...defaultAccount,
  id: "account-other",
  bankCode: "SCB",
  bankName: "Siam Commercial Bank",
  maskedAccountNumber: "•••• 3210",
  isDefault: false,
};

function respond(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

function mockLoad(
  balance = "500.00",
  accounts = [defaultAccount, otherAccount],
  tutorStatus = "APPROVED"
) {
  return jest
    .fn()
    .mockResolvedValueOnce(respond({ balance }))
    .mockResolvedValueOnce(respond({ accounts }))
    .mockResolvedValueOnce(respond({ status: tutorStatus }));
}

describe("wallet payout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("authToken", "student-token");
    Object.defineProperty(global.crypto, "randomUUID", {
      configurable: true,
      value: jest.fn(() => reference),
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("pays out to the default account after confirming and updates the navbar balance", async () => {
    global.fetch = mockLoad().mockResolvedValueOnce(
      respond({
        balance: "379.50",
        simulated: true,
        transaction: {
          id: reference,
          type: "PAYOUT",
          amount: "120.50",
          balanceAfter: "379.50",
          createdAt: "2026-10-24T04:00:00.000Z",
          payoutAccount: defaultAccount,
        },
      })
    );
    const published: string[] = [];
    const unsubscribe = subscribeToWalletBalance((balance) => published.push(balance));

    render(<WalletPayoutPage />);
    expect(await screen.findByText("฿500.00")).toBeInTheDocument();
    expect(screen.getByText("Simulated payout, no real money is transferred.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Kasikornbank •••• 7890/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Siam Commercial Bank •••• 3210/ })).not.toBeChecked();

    fireEvent.change(screen.getByLabelText("Amount (฿)"), { target: { value: "120.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Review payout" }));
    expect(screen.getByRole("heading", { name: "Pay out ฿120.50?" })).toBeInTheDocument();
    expect(screen.getByText(/Balance after payout ฿379\.50/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("button", { name: "Confirm payout" }));
    expect(await screen.findByRole("heading", { name: "Payout complete" })).toBeInTheDocument();
    expect(screen.getByText(/new balance ฿379\.50/)).toBeInTheDocument();
    expect(published).toEqual(["379.50"]);
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/payouts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 120.5, payoutAccountId: "account-default", reference }),
      })
    );
    unsubscribe();
  });

  it("sends the payout to another account the user picks", async () => {
    global.fetch = mockLoad();
    render(<WalletPayoutPage />);
    fireEvent.click(await screen.findByRole("radio", { name: /Siam Commercial Bank/ }));
    fireEvent.change(screen.getByLabelText("Amount (฿)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Review payout" }));
    expect(screen.getByText(/To Siam Commercial Bank •••• 3210/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change details" }));
    expect(screen.getByRole("radio", { name: /Siam Commercial Bank/ })).toBeChecked();
  });

  it("blocks an amount above the available balance before sending", async () => {
    global.fetch = mockLoad("100.00");
    render(<WalletPayoutPage />);
    expect(await screen.findByText("฿100.00")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Amount (฿)"), { target: { value: "100.01" } });
    fireEvent.click(screen.getByRole("button", { name: "Review payout" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The amount is more than your available balance of ฿100.00."
    );
    expect(screen.queryByRole("button", { name: "Confirm payout" })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("shows the server's balance error and returns to the form", async () => {
    global.fetch = mockLoad()
      .mockResolvedValueOnce(
        respond(
          {
            code: "INSUFFICIENT_BALANCE",
            message: "The amount is more than your available balance",
          },
          false
        )
      )
      .mockResolvedValueOnce(respond({ balance: "50.00" }));
    render(<WalletPayoutPage />);
    fireEvent.change(await screen.findByLabelText("Amount (฿)"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Review payout" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm payout" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The amount is more than your available balance"
    );
    expect(await screen.findByText("฿50.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review payout" })).toBeInTheDocument();
  });

  it("asks the user to add an account in Wallet settings when none is saved", async () => {
    global.fetch = mockLoad("500.00", []);
    render(<WalletPayoutPage />);

    expect(
      await screen.findByRole("heading", { name: "No saved payout account" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Wallet settings" })).toHaveAttribute(
      "href",
      "/settings/wallet"
    );
    expect(screen.queryByLabelText("Amount (฿)")).not.toBeInTheDocument();
  });

  it("explains that payouts are off when the server disables simulation", async () => {
    global.fetch = mockLoad().mockResolvedValueOnce(
      respond(
        {
          code: "MOCK_PAYMENT_DISABLED",
          message: "Simulated payouts are disabled in production",
        },
        false
      )
    );
    render(<WalletPayoutPage />);
    fireEvent.change(await screen.findByLabelText("Amount (฿)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Review payout" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm payout" }));

    expect(
      await screen.findByRole("heading", { name: "Payouts are not available here yet" })
    ).toBeInTheDocument();
    expect(screen.getByText("฿500.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm payout" })).not.toBeInTheDocument();
  });

  it("tells a user who is not a Tutor that payouts are for Tutors", async () => {
    global.fetch = mockLoad("500.00", [defaultAccount], "NONE");
    render(<WalletPayoutPage />);

    expect(
      await screen.findByRole("heading", { name: "Payouts are for Tutors" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Amount (฿)")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No saved payout account" })
    ).not.toBeInTheDocument();
  });

  it("shows a load error, not the Tutor-only message, when the Tutor check fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respond({ balance: "500.00" }))
      .mockResolvedValueOnce(respond({ accounts: [defaultAccount] }))
      .mockResolvedValueOnce(respond({ message: "Server error" }, false));
    render(<WalletPayoutPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your wallet. Please refresh and try again."
    );
    expect(
      screen.queryByRole("heading", { name: "Payouts are for Tutors" })
    ).not.toBeInTheDocument();
  });

  it("switches to the Tutor-only message when the server rejects the payout", async () => {
    global.fetch = mockLoad().mockResolvedValueOnce(
      respond({ code: "PAYOUT_TUTOR_ONLY", message: "Only Tutors can request a payout" }, false)
    );
    render(<WalletPayoutPage />);
    fireEvent.change(await screen.findByLabelText("Amount (฿)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Review payout" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm payout" }));

    expect(
      await screen.findByRole("heading", { name: "Payouts are for Tutors" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm payout" })).not.toBeInTheDocument();
  });

  it("redirects guests before loading wallet data", async () => {
    localStorage.clear();
    global.fetch = jest.fn();

    render(<WalletPayoutPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fwallet%2Fpayout"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
