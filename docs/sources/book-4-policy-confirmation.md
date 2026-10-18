---
type: raw
source: null
collected: 2026-10-18
published: null
---

Question: When a Tutor cancels inside the 24-hour window, what does the Student get back?

Answer: Always 100%. Inside 24 hours the Tutor sees a warning before confirming that it is a late cancellation, but no money moves from the Tutor.

Question: How does a Tutor get to the cancel button, given Tutors cannot see their bookings anywhere yet?

Answer: Add a small upcoming list to the Tutor dashboard tab (student, subject, time) linking to /bookings/:id, and show the cancel action there for the Tutor. The full tabs and payout view stay with BOOK-9.

Question: After a Tutor cancels, what happens to the freed slots?

Answer: Close them. The slots go back to the Tutor's calendar as closed, and the Tutor can reopen them in the availability editor.

Question: What does the Tutor have to give, and does the Student hear about it?

Answer: A required reason (max 500 characters), shown on the Student's booking page, and the Student gets a best-effort booking notification after commit.

Question: Booking has no field saying who cancelled. Should BOOK-4 add one?

Answer: Add a nullable `cancelledBy` (STUDENT, TUTOR) on Booking.
