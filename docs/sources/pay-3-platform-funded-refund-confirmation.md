---
type: raw
source: null
collected: 2026-11-10
published: null
---

User: "refund buttong shown after the end time, and the onw who pays for the refund is admin account (stored as from admin). and tutor still get the money since the pay-out is ocmplicated."

Question: This would conflict with the existing transaction design if "from admin" means a wallet transfer from the approving Admin. What should I do?

Answer: "I recommend adopting this simpler policy:

Scheduled lesson ends
  → Student may submit one refund request
  → Admin reviews it
  → If approved: Student gets a full refund funded by the platform
  → Tutor’s lesson earning remains unchanged
  → Tutor can still receive and pay out their earning normally

Make these decisions explicit:

1. Show Request refund only after the scheduled end time.
2. Send every request to admin review—no automatic no-show refund.
3. An approved refund does not cancel the booking, free slots, or remove the Tutor earning.
4. Do not block Tutor completion because of a refund request.
5. Record the approving admin in reviewedById, but do not debit that person’s wallet. The platform bears the cost.
6. Keep the Student-side REFUND ledger row. Platform expense accounting can be designed later with a dedicated system account, if needed."
