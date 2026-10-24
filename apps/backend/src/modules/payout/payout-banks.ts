// Thai banks a payout account can use, keyed by their short code.
export const payoutBanks = [
  { code: "BBL", name: "Bangkok Bank" },
  { code: "KBANK", name: "Kasikornbank" },
  { code: "KTB", name: "Krungthai Bank" },
  { code: "SCB", name: "Siam Commercial Bank" },
  { code: "BAY", name: "Bank of Ayudhya (Krungsri)" },
  { code: "TTB", name: "TMBThanachart Bank" },
  { code: "GSB", name: "Government Savings Bank" },
  { code: "BAAC", name: "Bank for Agriculture and Agricultural Cooperatives" },
  { code: "UOB", name: "UOB Thailand" },
  { code: "CIMBT", name: "CIMB Thai Bank" },
  { code: "KKP", name: "Kiatnakin Phatra Bank" },
  { code: "LHBANK", name: "Land and Houses Bank" },
] as const;

export type PayoutBankCode = (typeof payoutBanks)[number]["code"];

export const payoutBankCodes = payoutBanks.map((bank) => bank.code) as [
  PayoutBankCode,
  ...PayoutBankCode[],
];

export function payoutBankName(code: string) {
  return payoutBanks.find((bank) => bank.code === code)?.name ?? code;
}

export function maskAccountNumber(accountNumber: string) {
  return `•••• ${accountNumber.slice(-4)}`;
}
