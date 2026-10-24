---
type: raw
source: null
collected: 2026-10-24
published: null
---

Question: Is a PAY-7 payout a real bank transfer?

Answer: No. The payout is simulated, and it works like top-up: it is turned off in production.

Question: Where does a user request a payout?

Answer: On its own page, /wallet/payout, like /wallet/topup. The full /wallet page is PAY-5. The payout goes to a saved payout account. The default account is picked first and the user can choose another one.

Question: How is a payout stored?

Answer: As in the approved wallet ledger design. A successful payout appends one PAYOUT wallet transaction and debits the balance in the same serializable transaction. A failure writes nothing. There is no status column and no request table, because the payout finishes in one request.
