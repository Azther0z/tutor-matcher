---
type: raw
source: null
collected: 2026-11-09
published: null
---

Story: [PAY-3] Request a refund for an unsatisfactory or missed lesson

As a Student, I want to request a refund for an unsatisfactory or missed lesson, so that I receive the full value back as wallet credit when a refund is approved.

Acceptance Criteria

Given a lesson did not occur due to Tutor no-show, when the Student files a refund request, then the full paid amount is returned to the Student's wallet as credit.

Given a dispute requires review, when the Student submits a refund request, then it is routed to Support/Admin for manual resolution; an approved refund returns the full amount as wallet credit.

Given a lesson was completed successfully, when the Student requests a refund, then the refund request is rejected and the reason is shown.

Question: PAY-3 needs somewhere to store refund requests. May I add a new `refund_requests` table to schema.prisma? It would be modelled on `topup_requests`: booking, reason type (Tutor no-show / Unsatisfactory lesson), Student's details text, status PENDING/APPROVED/REJECTED, rejection reason, reviewing admin, timestamps, and one request per booking. It would be synced with `prisma db push`.

Answer: Yes, add the table (Recommended)

Question: Which refund requests pay out instantly, and which go to an Admin?

Answer: No-show instant, others Admin: No-show is refunded at once if the Tutor hasn't confirmed completion. Unsatisfactory goes to Admin. Requests on Tutor-confirmed COMPLETED lessons are auto-rejected with a reason.

Question: When can a Student file a refund request?

Answer: Lesson end to 3 days: from the scheduled lesson end. One request per booking. Later requests are rejected with the reason shown.

Question: What happens to the booking and the Tutor's earnings when a refund is approved?

Answer: Booking becomes CANCELLED (Recommended): Approval adds a REFUND row and sets the booking CANCELLED, so pending earnings drop it automatically. While a request is pending, the Tutor can't confirm completion. No money is taken from the Tutor because PAY-6 hasn't released anything yet.
