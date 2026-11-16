---
type: raw
source: https://github.com/Azther0z/tutor-matcher/pull/224
collected: 2026-11-12
published: null
---

PR #224 review comment (verbatim):

piranatw on apps/backend/src/modules/refund/refund.service.ts:47-51: A refund can now cancel a COMPLETED lesson, and a completed lesson can already hold a Review from #225. Nothing removes or hides that Review. The subject rating, its average and the public review list are computed from subjectId only, with no booking-status filter.
Sequence: the Student leaves 1 star, then asks for a refund, then the admin approves. The Student is repaid, and the 1-star review stays on the Tutor's public rating for a lesson that no longer exists. The reverse also works: a 5-star review is left, then the money is taken back. Fix: decide the rule and encode it. Either exclude reviews of CANCELLED bookings in the discovery queries, or have refundBooking delete the Review (or flag it hidden) in the same transaction.

User instruction: fix code following piranat review

Question: Piranat's PR #224 review: when an admin approves a refund on a lesson that already has a review, what should happen to that review?

Answer: Exclude from ratings (Recommended): Keep the review row, but leave reviews of CANCELLED bookings out of public ratings, averages, review lists and search ranking. No schema change, nothing deleted, and it applies to any future way a booking gets cancelled.

Question: While a refund request is pending, should the Student still be able to publish a review of that lesson?

Answer: Allow it (Recommended): No extra rule. If the refund is approved, the review drops out per the choice above; if rejected, it stays.
