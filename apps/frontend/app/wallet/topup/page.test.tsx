import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WalletTopupPage from "./page";

const replace = jest.fn();
let amountParam: string | null = "750";
let returnToParam: string | null = "/bookings/booking-1";

jest.mock("next/navigation", () => ({
  usePathname: () => "/wallet/topup",
  useRouter: () => ({ replace }),
  useSearchParams: () => ({
    get: (key: string) => (key === "amount" ? amountParam : returnToParam),
  }),
}));

const reference = "22222222-2222-4222-8222-222222222222";

describe("wallet top-up", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    amountParam = "750";
    returnToParam = "/bookings/booking-1";
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

  it("confirms a PromptPay transfer, updates the balance, and returns to the booking", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ balance: "250.00" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: "1000.00",
          transaction: {
            id: reference,
            type: "TOPUP",
            method: "PROMPTPAY",
            amount: "750.00",
            status: "COMPLETED",
            createdAt: "2026-10-11T04:00:00.000Z",
            completedAt: "2026-10-11T04:00:00.000Z",
          },
        }),
      });

    render(<WalletTopupPage />);
    expect(await screen.findByText("฿250.00")).toBeInTheDocument();
    expect(screen.getByLabelText("Or enter an amount (฿)")).toHaveValue(750);

    fireEvent.click(screen.getByRole("button", { name: "Show PromptPay QR" }));
    expect(screen.getByRole("img", { name: "PromptPay QR code" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I've completed the transfer" }));

    expect(await screen.findByRole("heading", { name: "Wallet topped up" })).toBeInTheDocument();
    expect(screen.getByText(/new balance ฿1,000\.00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to booking" })).toHaveAttribute(
      "href",
      "/bookings/booking-1"
    );
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/wallet/topups/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 750, reference }),
      })
    );
  });

  it("shows a failed confirmation and leaves the displayed balance unchanged", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ balance: "250.00" }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "The transfer was not confirmed." }),
      });

    render(<WalletTopupPage />);
    expect(await screen.findByText("฿250.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show PromptPay QR" }));
    fireEvent.click(screen.getByRole("button", { name: "I've completed the transfer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The transfer was not confirmed.");
    expect(screen.getByText("฿250.00")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Wallet topped up" })).not.toBeInTheDocument();
  });

  it("redirects guests before loading wallet data", async () => {
    localStorage.clear();
    global.fetch = jest.fn();

    render(<WalletTopupPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fwallet%2Ftopup"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
