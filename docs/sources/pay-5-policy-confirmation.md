---
type: raw
source: null
collected: 2026-10-30
published: null
---

Question: Issue #159 (PAY-5) asks the transaction detail page to show direction and status, but the approved ledger has no status or direction column. How should they be shown?

Answer: Derive from type. Direction is In or Out from the transaction type (TOP_UP, LESSON_EARNING and REFUND are In; LESSON_PAYMENT and PAYOUT are Out). Status always shows Completed, because every row is a completed movement. The schema does not change.

Question: Issue #159 mentions an "unfinished lesson payment", but an unpaid booking has no ledger row and appears only on /bookings. What should PAY-5 do?

Answer: Show a Payment due notice on /wallet. Do not add a pending ledger row. /wallet shows a Payment due box listing the user's PENDING_PAYMENT bookings, each linking to /bookings/:id to pay there. The detail page has no pay button and links to the related booking.

Question: /wallet shows available balance, pending earnings, earnings this month and all-time paid out, but no platform fee exists in code (user-journeys gives a provisional 15%). How should the summary cards work?

Answer: All four, with a 15% fee. Pending earnings are the Tutor's CONFIRMED booking totals minus 15% (a backend constant) and are shown only to Tutors. The other figures are calculated from the ledger.
