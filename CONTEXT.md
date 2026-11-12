---
name: tutor-matcher
description: Domain vocabulary for the Tutor Matcher platform.
---

# Tutor Matcher

A matchmaking platform that connects tutors and students by subject, schedule, and
price. A student finds a tutor, opens one of that tutor's subjects, picks a
continuous block of the tutor's published 30-minute slots, and pays for it from a
single wallet balance. Payment confirms the lesson immediately — there is no tutor
approval step, because the tutor already published the slot.

Behavioural authority for these terms is [`docs/user-journeys.md`](docs/user-journeys.md),
which overrides the historical prototype evidence preserved in `docs/sources/`.
See [`docs/user-journeys.md`](docs/user-journeys.md) for the flows and
[`docs/database-schema.md`](docs/database-schema.md) for the data model.

## Language

**User**:
Any registered account. Every account is created as a student; tutor and admin are
capabilities added on top of the same account, never separate account types.
_Avoid_: Member, customer

**Student**:
The default capability of every user — searching tutors, booking slots, paying from
the wallet, messaging tutors, and reviewing completed lessons. A user is a student
from sign-up; nothing has to be granted.
_Avoid_: Learner, client, buyer

**Tutor**:
A user whose initial tutor application has been approved by an admin. A tutor owns
subjects, teaches booked lessons, and chooses whether their listing accepts new bookings.
_Avoid_: Teacher, instructor, provider

**Admin**:
A user with elevated access who approves or rejects tutor applications and listing
changes, moderates flagged content, resolves payment disputes, and suspends or bans
accounts. The capability can be added during sign-up with a valid backend-configured
admin signup key.
_Avoid_: Moderator, staff, superuser

**Tutor Application**:
A student's submitted profile version requesting the tutor capability, with identity,
optional teaching credentials, introduction video, and bio for admin review.
_Avoid_: Tutor signup, tutor registration, enrolment

**Tutor Profile Version**:
One complete proposed or approved set of tutor profile content and verification documents.
The current approved version remains in use while a replacement awaits review.
_Avoid_: Separate tutor account, duplicate live profile

**Tutor Profile Draft**:
A user's saved, editable profile version that has not been submitted for review.
A user may keep several drafts while only one submitted version awaits an admin decision.
_Avoid_: Pending application, published profile

**Verification Document**:
The private identification-card URL attached to a tutor application and checked by an admin.
Replacing a document re-enters admin review
before becoming current.
_Avoid_: Transfer proof, attachment, credential

**Tutor Portfolio Certificate**:
An optional certificate URL showing a tutor's achievements, contest participation or qualifications.
Certificates belong to a profile version. The Tutor form does not collect them while document
upload and storage are deferred, and student pages do not show them.
_Avoid_: Private identity document, mandatory teaching license

**Listing**:
The tutor's approved public profile. Publication controls discovery and new bookings;
unpublishing preserves existing lessons and conversations, independently of profile review.
_Avoid_: Tutor page, storefront, public profile

**Subject**:
One teaching offering owned by a tutor, with its own name, description, hourly rate,
format, and one to three learning areas for discovery. A subject — not the tutor — is what a student books, and it has its own
detail page, availability view, and reviews. One tutor has many subjects.
_Avoid_: Class, course, category, topic

**Availability Slot**:
A 30-minute window on a specific date that a tutor has opened for teaching. The slot
belongs to the tutor, and the tutor assigns one or more of their subjects to it, so a
student browsing a subject sees only the slots that advertise that subject. A slot is
locked to one booking during an active payment hold or after payment.
_Avoid_: Time slot, open slot, schedule entry, recurring availability schedule

**Booking**:
One student and one tutor, one subject, and one continuous block of back-to-back
availability slots. A booking exists only once a time has been chosen; before that,
the student is still in the subject booking flow with no booking record. Statuses are
`payment due`, `confirmed`, `completed`, and `cancelled`. `Confirmed` means paid and
scheduled; after the lesson's scheduled end, it remains confirmed until the assigned
Tutor manually confirms completion, which changes it to `completed`.
_Avoid_: Reservation, appointment, order, class booking

**Lesson**:
The delivery of a confirmed booking at its scheduled time, online through an attached
meeting link. Product surfaces say lesson (student side) or class (tutor side); both
mean the delivery of one booking.
_Avoid_: Session, meeting, appointment

**Wallet**:
One balance per user holding topped-up money and cleared tutor earnings together. It
funds lesson payments and payouts. Paid lesson funds are held by the platform for the booking until refunded or settled. A user who
is both a student and a tutor has one wallet, not two.
_Avoid_: Credits, account balance, points, tutor balance

**Wallet Transaction**:
One completed movement for exactly one user's wallet, carrying a type, positive amount,
resulting balance and timestamp. Rows are append-only, with no status or direction.
TOP_UP, LESSON_EARNING and REFUND add; LESSON_PAYMENT and PAYOUT subtract.
The signed ledger reconciles to the user's available balance; unpaid bookings have no row.
_Avoid_: Payment record, ledger line, charge

**Top-up**:
Money entering a wallet by PromptPay transfer. The user sends a slip link as a **Top-up
Request**; an admin checks the slip and approval appends TOP_UP. Nothing is credited before.
_Avoid_: Deposit, recharge, buying credits

**Top-up Request**:
A user's pending top-up with its amount and slip link, waiting for an admin. It ends
approved or rejected (with a reason); one may be pending per user.
_Avoid_: Transfer proof, deposit request

**Lesson Payment**:
The debit that a student makes from wallet balance on the booking page to confirm a
booking. If the balance is short, the booking page sends the student to top up the
difference and come back; the slot stays locked to the booking meanwhile.
_Avoid_: Checkout, transfer proof, invoice

**Lesson Earning**:
The Tutor's share after the platform fee. Pending earnings are calculated from
CONFIRMED and COMPLETED bookings without a LESSON_EARNING row. Tutor confirmation
keeps the amount pending until 24 hours after the scheduled lesson end. A pending
refund request holds the earning until an Admin decides; settlement appends
LESSON_EARNING when the Tutor next reads or uses their wallet. See docs/user-journeys.md §4.
_Avoid_: Income, revenue, salary

**Payout**:
A withdrawal of available wallet balance to a saved payout account. Payouts are
tutor-only: a Tutor with available balance can request one; students cannot withdraw.
_Avoid_: Withdrawal request, cash-out, transfer

**Payout Account**:
The bank account a Tutor's payouts are sent to. Only Tutors hold them; a Tutor may hold
more than one and marks one as default.
_Avoid_: Payment method, bank details

**Refund**:
A credit returned to a student's wallet when an eligible booking is cancelled or a
dispute is resolved in the student's favour.
_Avoid_: Chargeback, reversal, credit note

**Refund Request**:
A Student's request, after a paid lesson's scheduled end, for the full paid amount back.
The reason is a Tutor no-show, an unsatisfactory lesson or another problem. An admin
approves every request or rejects it with a reason; approval refunds and cancels the
booking. One per booking.
_Avoid_: Dispute ticket, claim, chargeback request

**Review**:
A rating and comment a student writes from their own completed booking. A review is
attached to that tutor and that subject, so subject pages show only their own reviews.
A review has one public Tutor reply. The reviewed Tutor can edit that reply; edited
replies show an Edited marker. Public Tutor and Subject pages show its current text.
_Avoid_: Feedback, rating, testimonial

**Review Flag**:
A signed-in member's report that a review's comment is inappropriate, with a reason. A
member flags a review once; it stays public while an admin decides, and only the flagger sees
it marked Flagged.
_Avoid_: Report, complaint, abuse report

**Conversation**:
The message thread between one student and one tutor. A user with both capabilities
switches which side of their conversations they are reading without a second account.
_Avoid_: Chat, inbox, DM

**Report**:
A complaint filed by one user against another, or a flag raised on a review or
message, routed to an admin who keeps, hides, or removes the content and records the
outcome.
_Avoid_: Ticket, complaint, issue

**Account Action**:
An Admin's recorded suspension or ban of a user, including who acted, the reason, the
time and, for a suspension, when it ends. An active action blocks login and protected
requests. It is separate from a Report or a tutor-profile review decision.
_Avoid_: User deletion, report status

**Notification Preference**:
A user's per-event choice of which channels may notify them. Event groups are booking
updates, lesson reminders, new messages, wallet and payments, and product news.
_Avoid_: Settings, alerts, subscriptions

## Retired Terms

These terms appeared in the database-course Final Report and in earlier documentation.
They are not part of the product and must not be reintroduced.

| Retired term       | Use instead                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| **Class** (entity) | **Subject** for the offering; **Lesson** for the delivered booking     |
| **Transfer Proof** | **Top-up** (PromptPay) and **Wallet Transaction**                     |
| **Payment** slip   | **Lesson Payment** / **Wallet Transaction**                           |
| **Post**           | — no promotional posting feature exists in the product                 |
| **Member**         | **User**                                                               |
