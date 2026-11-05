import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const slipUrl = "https://drive.example.com/slip-750";
const pending = {
  id: "22222222-2222-4222-8222-222222222222",
  amount: "750.00",
  slipUrl,
  status: "PENDING",
  createdAt: "2026-11-03T04:00:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
};
const rejected = {
  ...pending,
  id: "33333333-3333-4333-8333-333333333333",
  amount: "50.00",
  status: "REJECTED",
  rejectionReason: "The slip shows ฿5",
};

function respond(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

// Routes each request by URL and method so the order of calls does not matter.
function mockApi(
  recent: unknown[],
  next: Record<string, unknown> = {},
  promptPayId = "0000000000"
) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    if (key in next) {
      const value = next[key] as { body: unknown; ok?: boolean };
      return respond(value.body, value.ok ?? true);
    }
    if (url === "/api/wallet") return respond({ balance: "250.00" });
    if (url === "/api/wallet/topups") return respond({ requests: recent, promptPayId });
    throw new Error(`Unexpected ${key}`);
  }) as jest.Mock;
}

describe("wallet top-up by slip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    amountParam = "750";
    returnToParam = "/bookings/booking-1";
    localStorage.setItem("authToken", "student-token");
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("sends the amount with a slip link and waits for review", async () => {
    mockApi([], { "POST /api/wallet/topups": { body: pending } });
    render(<WalletTopupPage />);

    expect(await screen.findByText("฿250.00")).toBeInTheDocument();
    expect(screen.getByLabelText("Or enter an amount (฿)")).toHaveValue(750);
    fireEvent.click(screen.getByRole("button", { name: "Show PromptPay QR" }));
    expect(screen.getByRole("img", { name: "PromptPay QR code" })).toBeInTheDocument();
    expect(screen.getByText(/The amount is already filled in/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulate/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Link to your transfer slip"), {
      target: { value: ` ${slipUrl} ` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send slip for review" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Slip sent");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/wallet/topups",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 750, slipUrl }),
        headers: expect.objectContaining({ Authorization: "Bearer student-token" }),
      })
    );
    expect(screen.getByRole("heading", { name: "Top-up of ฿750.00" })).toBeInTheDocument();
    expect(screen.getByText("฿250.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View slip" })).toHaveAttribute("href", slipUrl);
    expect(screen.getByText(/Your booking is held for a limited time/)).toBeInTheDocument();
  });

  it("checks the slip link before sending anything", async () => {
    mockApi([]);
    render(<WalletTopupPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Show PromptPay QR" }));
    fireEvent.change(screen.getByLabelText("Link to your transfer slip"), {
      target: { value: "my slip" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send slip for review" }));

    expect(screen.getByText("Paste a link that starts with http:// or https://.")).toBeVisible();
    expect(screen.getByLabelText("Link to your transfer slip")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    const calls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit?][];
    expect(calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("validates the amount before showing the QR", async () => {
    mockApi([]);
    render(<WalletTopupPage />);
    fireEvent.change(await screen.findByLabelText("Or enter an amount (฿)"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show PromptPay QR" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount between");
    expect(screen.queryByLabelText("Link to your transfer slip")).not.toBeInTheDocument();
  });

  it("shows a pending top-up with no way to cancel it or leave", async () => {
    mockApi([pending]);
    render(<WalletTopupPage />);

    expect(await screen.findByRole("heading", { name: "Top-up of ฿750.00" })).toBeInTheDocument();
    expect(screen.getAllByText("Pending approval").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Show PromptPay QR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /booking/i })).not.toBeInTheDocument();
  });

  it("turns top-up off when the PromptPay ID is not valid", async () => {
    mockApi([], {}, "081-234-5678");
    render(<WalletTopupPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Top-up is not available");
    expect(screen.getByRole("button", { name: "Show PromptPay QR" })).toBeDisabled();
  });

  it("lists recent top-ups with the rejection reason", async () => {
    mockApi([rejected]);
    render(<WalletTopupPage />);

    const recent = await screen.findByRole("region", { name: "Recent top-ups" });
    expect(within(recent).getByText("฿50.00")).toBeInTheDocument();
    expect(within(recent).getByText("Rejected")).toBeInTheDocument();
    expect(within(recent).getByText("Reason: The slip shows ฿5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show PromptPay QR" })).toBeInTheDocument();
  });

  it("shows the server message when a second pending top-up is refused", async () => {
    mockApi([], {
      "POST /api/wallet/topups": {
        ok: false,
        body: { code: "TOPUP_PENDING_EXISTS", message: "You already have a top-up waiting" },
      },
    });
    returnToParam = null;
    render(<WalletTopupPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Show PromptPay QR" }));
    fireEvent.change(screen.getByLabelText("Link to your transfer slip"), {
      target: { value: slipUrl },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send slip for review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You already have a top-up waiting");
  });

  it("redirects guests before loading wallet data", async () => {
    localStorage.clear();
    global.fetch = jest.fn();
    render(<WalletTopupPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fwallet%2Ftopup"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
