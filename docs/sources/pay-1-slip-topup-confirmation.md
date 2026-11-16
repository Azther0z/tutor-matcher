---
type: raw
source: null
collected: 2026-11-03
published: null
---

Question: The simulated top-up is turned off in production, so the deployed demo cannot add money. How should a top-up work instead?

Answer: Make it real but checked by hand. The user enters an amount, transfers by PromptPay, and submits a link to the transfer slip. An admin checks the slip and approves it, and only then is the amount added to the balance. It works like the become-a-tutor review. The QR stays a placeholder because the team has no account to receive money, and there is no PromptPay API for now, only a slip URL. The admin step is the bottleneck, which is acceptable until there are hundreds of users.

Question: What happens to the simulated top-up?

Answer: Replace it everywhere. The same slip flow runs in development and production, with no simulation buttons.

Question: What can an admin do with a pending slip?

Answer: Approve or reject, like tutor requests. Approval credits the requested amount. A rejection needs a reason the user sees. Admins cannot change the amount.

Question: How many top-ups can wait for review at once?

Answer: One per user. The user waits for the review or cancels the pending top-up before sending another.

Question: Is a schema change allowed for this?

Answer: Yes. A new top-up request table holds the pending, approved, rejected and cancelled requests. Approval appends the TOP_UP wallet transaction; the ledger keeps no status.
