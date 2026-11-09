---
type: raw
source: null
collected: 2026-11-06
published: null
---

Question: PAY-5 currently calculates the Tutor share using a provisional 15% platform fee, rounded per booking. Should CLASS-3 use that same calculation against the booking’s agreed total? For example, a ฿100 booking credits ฿85.

Answer: Use the existing 15% calculation (Recommended): pending and released amounts stay consistent.

Question: Review submission is not implemented yet; REV-1 (#168) owns it. What should this PR deliver for the Student?

Answer: Expose review eligibility only; REV-1 builds submission later: #212’s review acceptance criterion remains dependent on that work.

Question: CLASS-2 may already have marked bookings COMPLETED without crediting Tutor earnings. Should this PR release money for those historical completions too?

Answer: no reconciliation. just keep the code fresh from historical implementation

User correction: Credit immediately when the Tutor confirms (Recommended): matches #212; the hold-period requirement must be reconciled separately. -> dont credit immediately into the wallet. make it pending credit instead

Question: Should CLASS-3 keep the 85% net earning in calculated pending earnings after Tutor confirmation and leave release into the available wallet balance to PAY-6 (#160)? Or should this PR also implement release after a defined hold period?

Answer: CLASS-3 keeps it pending; PAY-6 handles release later (Recommended): no available-balance credit or pending ledger row in this PR.
