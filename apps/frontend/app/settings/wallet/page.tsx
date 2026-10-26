"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/src/components/require-auth";
import { SettingsSidebar } from "@/src/components/settings-sidebar";
import {
  addPayoutAccount,
  getPayoutAccounts,
  getPayoutBanks,
  MAX_PAYOUT_ACCOUNTS,
  removePayoutAccount,
  setDefaultPayoutAccount,
  type PayoutAccount,
  type PayoutBank,
} from "@/src/lib/payout-accounts-api";
import { isTutor } from "@/src/lib/payouts-api";
import { getWallet } from "@/src/lib/wallet-api";

type FieldErrors = Partial<Record<"bankCode" | "accountHolderName" | "accountNumber", string>>;

const balanceFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inputClassName =
  "h-11 rounded-lg border border-black/[.12] bg-background px-3 text-base outline-none focus:border-foreground aria-[invalid=true]:border-red-500 dark:border-white/[.18] dark:[color-scheme:dark]";
const primaryButton =
  "flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]";
const secondaryButton =
  "flex h-11 items-center justify-center rounded-full border border-black/[.12] px-5 text-base font-medium transition-colors hover:bg-black/[.06] dark:border-white/[.18] dark:hover:bg-white/[.08]";
const smallButton =
  "rounded-full border border-black/[.12] px-3 py-1.5 text-sm font-medium hover:bg-black/[.06] disabled:opacity-60 dark:border-white/[.18] dark:hover:bg-white/[.08]";
const dangerButton =
  "rounded-full border border-red-600/40 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-400/40 dark:text-red-400 dark:hover:bg-red-950/40";

function validate(bankCode: string, accountHolderName: string, accountNumber: string) {
  const errors: FieldErrors = {};
  if (!bankCode) errors.bankCode = "Choose a bank.";
  if (!accountHolderName.trim()) errors.accountHolderName = "Enter the account holder name.";
  else if (accountHolderName.trim().length > 100)
    errors.accountHolderName = "Use 100 characters or fewer.";
  if (!/^\d{10,15}$/.test(accountNumber.replace(/[\s-]/g, "")))
    errors.accountNumber = "Enter a 10 to 15 digit account number.";
  return errors;
}

function WalletSettings() {
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [showPayoutLink, setShowPayoutLink] = useState(false);
  const [accounts, setAccounts] = useState<PayoutAccount[] | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [bankCode, setBankCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    getWallet()
      .then((wallet) => setBalance(wallet.balance))
      .catch(() => setBalanceError("Could not load your wallet balance."));
    // A failed check still shows the link; the payout page checks again and explains.
    isTutor()
      .then(setShowPayoutLink)
      .catch(() => setShowPayoutLink(true));
    Promise.all([getPayoutAccounts(), getPayoutBanks()])
      .then(([savedAccounts, bankList]) => {
        setAccounts(savedAccounts);
        setBanks(bankList);
      })
      .catch(() =>
        setLoadError("We could not load your payout accounts. Please refresh and try again.")
      );
  }, []);

  async function run(
    action: () => Promise<PayoutAccount[]>,
    success: string,
    showError = setActionError
  ) {
    setBusy(true);
    setMessage(null);
    setActionError(null);
    setFormError(null);
    try {
      setAccounts(await action());
      setMessage(success);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not update your accounts.");
      return false;
    } finally {
      setBusy(false);
      setConfirmingRemove(null);
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(bankCode, accountHolderName, accountNumber);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const added = await run(
      () =>
        addPayoutAccount({
          bankCode,
          accountHolderName: accountHolderName.trim(),
          accountNumber: accountNumber.replace(/[\s-]/g, ""),
          ...(accounts && accounts.length > 0 ? { makeDefault } : {}),
        }),
      "Payout account added.",
      setFormError
    );
    if (added) {
      setBankCode("");
      setAccountHolderName("");
      setAccountNumber("");
      setMakeDefault(false);
    }
  }

  const atLimit = (accounts?.length ?? 0) >= MAX_PAYOUT_ACCOUNTS;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16 sm:flex-row">
      <SettingsSidebar activeSection="wallet" />

      <div className="flex flex-1 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Tutor Matcher
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Wallet settings</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Choose the bank accounts your wallet balance is paid out to.
          </p>
        </div>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]">
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Wallet balance</h2>
            {balanceError ? (
              <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {balanceError}
              </p>
            ) : (
              <p className="mt-1 text-3xl font-semibold">
                {balance === null ? "Loading…" : `฿${balanceFormat.format(Number(balance))}`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {showPayoutLink && (
              <Link href="/wallet/payout" className={secondaryButton}>
                Request payout
              </Link>
            )}
            <Link href="/wallet/topup" className={primaryButton}>
              Top up
            </Link>
          </div>
        </section>

        {loadError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {loadError}
          </p>
        )}

        {accounts && (
          <section
            aria-label="Payout accounts"
            className="flex flex-col gap-4 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]"
          >
            <div>
              <h2 className="text-xl font-semibold">Payout accounts</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Payouts go to your default account unless you pick another one. Account numbers are
                hidden after saving.
              </p>
            </div>

            {accounts.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No payout accounts yet. Add a bank account below to withdraw your balance.
              </p>
            ) : (
              <ul className="divide-y divide-black/[.08] dark:divide-white/[.12]">
                {accounts.map((account) => (
                  <li
                    key={account.id}
                    aria-label={`${account.bankName} ${account.maskedAccountNumber}`}
                    className="flex flex-col gap-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {account.bankName}
                          {account.isDefault && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="break-words text-sm text-zinc-500">
                          {account.accountHolderName} · {account.maskedAccountNumber}
                        </p>
                      </div>
                      {confirmingRemove !== account.id && (
                        <div className="flex gap-2">
                          {!account.isDefault && (
                            <button
                              type="button"
                              className={smallButton}
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => setDefaultPayoutAccount(account.id),
                                  "Default account updated."
                                )
                              }
                            >
                              Set default
                            </button>
                          )}
                          <button
                            type="button"
                            className={dangerButton}
                            disabled={busy}
                            onClick={() => {
                              setMessage(null);
                              setConfirmingRemove(account.id);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    {confirmingRemove === account.id && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-600/30 p-3 dark:border-red-400/30">
                        <p className="text-sm">
                          Remove this account?
                          {account.isDefault && accounts.length > 1
                            ? " Your oldest other account becomes the default."
                            : ""}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={smallButton}
                            disabled={busy}
                            onClick={() => setConfirmingRemove(null)}
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            className={dangerButton}
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () => removePayoutAccount(account.id),
                                "Payout account removed."
                              )
                            }
                          >
                            {busy ? "Removing…" : "Remove account"}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {message && (
              <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
                {message}
              </p>
            )}
            {actionError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {actionError}
              </p>
            )}
          </section>
        )}

        {accounts && (
          <form
            onSubmit={handleAdd}
            noValidate
            className="flex flex-col gap-5 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]"
          >
            <div>
              <h2 className="text-xl font-semibold">Add account</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Thai bank accounts only. To change an account, remove it and add it again.
              </p>
            </div>

            {atLimit ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                You can save up to {MAX_PAYOUT_ACCOUNTS} payout accounts. Remove one to add another.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5 text-sm font-medium">
                  <label htmlFor="bankCode">Bank</label>
                  <select
                    id="bankCode"
                    value={bankCode}
                    onChange={(event) => setBankCode(event.target.value)}
                    aria-invalid={!!fieldErrors.bankCode}
                    aria-describedby={fieldErrors.bankCode ? "bankCode-error" : undefined}
                    className={inputClassName}
                  >
                    <option value="">Choose a bank</option>
                    {banks.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.bankCode && (
                    <span id="bankCode-error" className="font-normal text-red-600">
                      {fieldErrors.bankCode}
                    </span>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 text-sm font-medium">
                    <label htmlFor="accountHolderName">Account holder name</label>
                    <input
                      id="accountHolderName"
                      type="text"
                      autoComplete="name"
                      maxLength={100}
                      value={accountHolderName}
                      onChange={(event) => setAccountHolderName(event.target.value)}
                      aria-invalid={!!fieldErrors.accountHolderName}
                      aria-describedby={
                        fieldErrors.accountHolderName ? "accountHolderName-error" : undefined
                      }
                      className={inputClassName}
                    />
                    {fieldErrors.accountHolderName && (
                      <span id="accountHolderName-error" className="font-normal text-red-600">
                        {fieldErrors.accountHolderName}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm font-medium">
                    <label htmlFor="accountNumber">Account number</label>
                    <input
                      id="accountNumber"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      aria-invalid={!!fieldErrors.accountNumber}
                      aria-describedby={
                        fieldErrors.accountNumber ? "accountNumber-error" : undefined
                      }
                      className={inputClassName}
                    />
                    {fieldErrors.accountNumber && (
                      <span id="accountNumber-error" className="font-normal text-red-600">
                        {fieldErrors.accountNumber}
                      </span>
                    )}
                  </div>
                </div>

                {accounts.length > 0 ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={makeDefault}
                      onChange={(event) => setMakeDefault(event.target.checked)}
                      className="h-4 w-4 rounded border-black/[.25] dark:border-white/[.3]"
                    />
                    Make this my default account
                  </label>
                ) : (
                  <p className="text-sm text-zinc-500">Your first account becomes your default.</p>
                )}

                {formError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end">
                  <button type="submit" disabled={busy} className={primaryButton}>
                    {busy ? "Saving…" : "Add account"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

export default function WalletSettingsPage() {
  return (
    <RequireAuth>
      <WalletSettings />
    </RequireAuth>
  );
}
