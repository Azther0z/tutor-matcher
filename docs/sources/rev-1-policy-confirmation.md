---
type: raw
source: null
collected: 2026-11-10
published: null
---

Epic-story ID: REV-1

As a Student, I want to rate and review a Tutor for the subject of my own completed lesson, so that other students see feedback for that exact tutor-subject combination.

Acceptance Criteria

Given the Student has their own lesson marked 'Completed' for a tutor and subject, when the Student submits a rating (1-5) and optional comment, then the review is published, scoped to that tutor AND that subject.

Given the lesson is not the Student's own completed booking, or the rating value is outside the allowed range, when the Student submits a review, then the review is rejected and an error is shown.

Scope
In Scope
The behaviour described by the acceptance criteria above
Out Of Scope
Anything not described by the acceptance criteria above

Question: REV-1 allows one review per completed booking. The `reviews` table has no unique constraint on `booking_id` (database-schema.md lists this as integrity rule #9, unenforced). How should 'one review per booking' be enforced?

Answer: Add UNIQUE on booking_id (Recommended): One-line schema change synced with `prisma db push`. The database itself guarantees one review per booking, even when two submissions race. The seed has one review per booking, so no data is lost.

Question: `prisma db push` on the REV-1 branch would drop your local `refund_requests` table (1 row from PAY-3 testing), because PAY-3 isn't merged into main yet. How should I add REV-1's unique key to your local database?

Answer: Add only the index with SQL (Recommended): Run `CREATE UNIQUE INDEX reviews_booking_id_key ON reviews(booking_id)` (Prisma's own name), and drop the now-redundant plain index. Keeps the refund row.
