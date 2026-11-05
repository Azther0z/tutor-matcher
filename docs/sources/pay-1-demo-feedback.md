---
type: raw
source: null
collected: 2026-11-06
published: null
---

Question: After the demo of the slip top-up, should the QR stay a placeholder?

Answer: Use a PromptPay QR, because the agreed flow is that the user enters an amount and gets a QR with that amount locked. Use `0000000000` as the placeholder number: a banking app can really scan it and show the check page, but cannot complete the transfer. Add a `PROMPTPAY_ID` backend setting that replaces the placeholder when it has a value. Leave it blank for now.

Question: The pending view has Cancel top-up and Back to bookings buttons. Are they needed?

Answer: No. Remove both. Once the slip is sent there is nothing to cancel, and the page should plainly show that it is pending approval.

Question: Does a top-up still need a cancelled status once users cannot cancel?

Answer: No. Remove it. The status is only pending, approved or rejected. After a rejection the user can send a new request with the unused slip and the right amount, or contact support. Admins check slips by hand, so there is no duplicate slip check.

Question: What should the admin top-up page show?

Answer: Admins should be able to see all requests, not only one status at a time. The rows should also be more compact.
