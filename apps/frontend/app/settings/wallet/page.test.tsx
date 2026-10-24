import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import WalletSettingsPage from "./page";

const mockReplace = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/settings/wallet",
  useRouter: () => ({ push: mockReplace, replace: mockReplace }),
}));

const banks = [
  { code: "KBANK", name: "Kasikornbank" },
  { code: "SCB", name: "Siam Commercial Bank" },
];
const kbank = {
  id: "a1111111-1111-4111-8111-111111111111",
  bankCode: "KBANK",
  bankName: "Kasikornbank",
  accountHolderName: "Student One",
  maskedAccountNumber: "•••• 7890",
  isDefault: true,
  createdAt: "2026-10-24T04:00:00.000Z",
};
const scb = {
  ...kbank,
  id: "b2222222-2222-4222-8222-222222222222",
  bankCode: "SCB",
  bankName: "Siam Commercial Bank",
  maskedAccountNumber: "•••• 1234",
  isDefault: false,
};

function ok(body: unknown) {
  return { ok: true, json: async () => body };
}

// The page loads the wallet, then the accounts and the bank list.
function mockLoad(accounts: unknown[], balance = "1250.50") {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/wallet") return ok({ balance });
    if (url === "/api/payout-accounts/banks") return ok({ banks });
    if (url === "/api/payout-accounts" && !init?.method) return ok({ accounts });
    throw new Error(`Unexpected request ${init?.method ?? "GET"} ${url}`);
  });
}

function mockNext(body: unknown, okResponse = true) {
  const load = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
    init?.method ? { ok: okResponse, json: async () => body } : load(url, init)
  );
}

beforeEach(() => {
  mockReplace.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "student-token");
});

describe("WalletSettingsPage", () => {
  it("shows the balance with a top-up link and the empty state", async () => {
    mockLoad([]);
    render(<WalletSettingsPage />);

    expect(await screen.findByText("฿1,250.50")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Top up" })).toHaveAttribute("href", "/wallet/topup");
    expect(screen.getByRole("link", { name: "Wallet" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText(/No payout accounts yet/)).toBeInTheDocument();
    expect(screen.getByText("Your first account becomes your default.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/payout-accounts",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer student-token" }),
      })
    );
  });

  it("lists saved accounts with the masked number and a Default badge", async () => {
    mockLoad([kbank, scb]);
    render(<WalletSettingsPage />);

    const defaultRow = await screen.findByRole("listitem", { name: "Kasikornbank •••• 7890" });
    expect(within(defaultRow).getByText("Default")).toBeInTheDocument();
    expect(within(defaultRow).getByText("Student One · •••• 7890")).toBeInTheDocument();
    expect(within(defaultRow).queryByRole("button", { name: "Set default" })).toBeNull();
    const otherRow = screen.getByRole("listitem", { name: "Siam Commercial Bank •••• 1234" });
    expect(within(otherRow).queryByText("Default")).toBeNull();
    expect(within(otherRow).getByRole("button", { name: "Set default" })).toBeInTheDocument();
  });

  it("validates the form before sending anything", async () => {
    mockLoad([]);
    render(<WalletSettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Add account" }));
    expect(screen.getByText("Choose a bank.")).toBeInTheDocument();
    expect(screen.getByText("Enter the account holder name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a 10 to 15 digit account number.")).toBeInTheDocument();
    expect(screen.getByLabelText("Bank")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("adds an account and shows it in the list", async () => {
    mockLoad([]);
    mockNext({ accounts: [kbank] });
    render(<WalletSettingsPage />);

    fireEvent.change(await screen.findByLabelText("Bank"), { target: { value: "KBANK" } });
    fireEvent.change(screen.getByLabelText("Account holder name"), {
      target: { value: " Student One " },
    });
    fireEvent.change(screen.getByLabelText("Account number"), {
      target: { value: "123-4-56789-0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));

    expect(await screen.findByText("Payout account added.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/payout-accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          bankCode: "KBANK",
          accountHolderName: "Student One",
          accountNumber: "1234567890",
        }),
      })
    );
    expect(screen.getByRole("listitem", { name: "Kasikornbank •••• 7890" })).toBeInTheDocument();
    expect(screen.getByLabelText("Account number")).toHaveValue("");
  });

  it("can make a new account the default", async () => {
    mockLoad([kbank]);
    mockNext({
      accounts: [
        { ...scb, isDefault: true },
        { ...kbank, isDefault: false },
      ],
    });
    render(<WalletSettingsPage />);

    fireEvent.change(await screen.findByLabelText("Bank"), { target: { value: "SCB" } });
    fireEvent.change(screen.getByLabelText("Account holder name"), {
      target: { value: "Student One" },
    });
    fireEvent.change(screen.getByLabelText("Account number"), {
      target: { value: "9876501234" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Make this my default account" }));
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));

    await screen.findByText("Payout account added.");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1].body)).toMatchObject({ makeDefault: true });
  });

  it("shows a server error under the form", async () => {
    mockLoad([kbank]);
    mockNext({ code: "PAYOUT_ACCOUNT_LIMIT", message: "You can save up to 5" }, false);
    render(<WalletSettingsPage />);

    fireEvent.change(await screen.findByLabelText("Bank"), { target: { value: "SCB" } });
    fireEvent.change(screen.getByLabelText("Account holder name"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Account number"), {
      target: { value: "9876501234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can save up to 5");
  });

  it("hides the form at five accounts", async () => {
    mockLoad(
      Array.from({ length: 5 }, (_, index) => ({
        ...scb,
        id: `c${index}333333-3333-4333-8333-333333333333`,
        maskedAccountNumber: `•••• 000${index}`,
      }))
    );
    render(<WalletSettingsPage />);
    expect(await screen.findByText(/You can save up to 5 payout accounts/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add account" })).toBeNull();
  });

  it("sets another account as the default", async () => {
    mockLoad([kbank, scb]);
    mockNext({
      accounts: [
        { ...scb, isDefault: true },
        { ...kbank, isDefault: false },
      ],
    });
    render(<WalletSettingsPage />);

    const row = await screen.findByRole("listitem", { name: "Siam Commercial Bank •••• 1234" });
    fireEvent.click(within(row).getByRole("button", { name: "Set default" }));

    expect(await screen.findByText("Default account updated.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/payout-accounts/${scb.id}/default`,
      expect.objectContaining({ method: "PATCH" })
    );
    const updated = screen.getByRole("listitem", { name: "Siam Commercial Bank •••• 1234" });
    expect(within(updated).getByText("Default")).toBeInTheDocument();
  });

  it("asks inline before removing and can keep the account", async () => {
    const confirmSpy = jest.spyOn(window, "confirm");
    mockLoad([kbank, scb]);
    mockNext({ accounts: [{ ...scb, isDefault: true }] });
    render(<WalletSettingsPage />);

    const row = await screen.findByRole("listitem", { name: "Kasikornbank •••• 7890" });
    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
    expect(
      within(row).getByText("Remove this account? Your oldest other account becomes the default.")
    ).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Keep" }));
    expect(within(row).queryByText(/Remove this account\?/)).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);

    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(row).getByRole("button", { name: "Remove account" }));
    expect(await screen.findByText("Payout account removed.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/payout-accounts/${kbank.id}`,
      expect.objectContaining({ method: "DELETE" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("listitem", { name: "Kasikornbank •••• 7890" })).toBeNull()
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows an error when the accounts cannot be loaded", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/wallet" ? ok({ balance: "0.00" }) : { ok: false, json: async () => ({}) }
    );
    render(<WalletSettingsPage />);
    expect(
      await screen.findByText(
        "We could not load your payout accounts. Please refresh and try again."
      )
    ).toBeInTheDocument();
  });
});
