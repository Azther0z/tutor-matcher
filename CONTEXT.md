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

Behavioural authority for these terms is the clickable prototype captured in
[`docs/sources/tutormatcher-prototype-readme.md`](docs/sources/tutormatcher-prototype-readme.md)
and [`docs/sources/tutormatcher-prototype-user-stories.md`](docs/sources/tutormatcher-prototype-user-stories.md).
See [`docs/user-journeys.md`](docs/user-journeys.md) for the flows and
[`docs/project-schema.md`](docs/project-schema.md) for the data model.

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
A user whose tutor application has been approved. A tutor additionally publishes a
public listing, manages subjects and availability, teaches confirmed lessons, and
receives earnings into the same wallet.
_Avoid_: Teacher, instructor, provider

**Admin**:
A user with elevated access who approves or rejects tutor applications and listing
changes, moderates flagged content, resolves payment disputes, and suspends or bans
accounts.
_Avoid_: Moderator, staff, superuser

**Tutor Application**:
A student's request to gain the tutor capability, carrying a government ID document,
a teaching certification document, and a bio. It is `pending` until an admin approves
or rejects it; a pending application can be cancelled and re-submitted.
_Avoid_: Tutor signup, tutor registration, enrolment

**Verification Document**:
The government ID or teaching certification file attached to a tutor application and
checked by an admin. Replacing a document re-enters admin review.
_Avoid_: Transfer proof, attachment, credential

**Listing**:
The tutor's public profile content — display name, headline, bio, photo, intro video
URL, and published state. Listing and document changes go through admin review before
they go live.
_Avoid_: Tutor page, storefront, public profile

**Subject**:
One teaching offering owned by a tutor, with its own name, description, hourly rate,
and format. A subject — not the tutor — is what a student books, and it has its own
detail page, availability view, and reviews. One tutor has many subjects.
_Avoid_: Class, course, category, topic

**Availability Slot**:
A 30-minute window on a specific date that a tutor has opened for teaching. The slot
belongs to the tutor, and the tutor assigns one or more of their subjects to it, so a
student browsing a subject sees only the slots that advertise that subject. A slot is
locked to one booking once that booking is paid.
_Avoid_: Time slot, open slot, schedule entry, weekly availability

**Booking**:
One student and one tutor, one subject, and one continuous block of back-to-back
availability slots. A booking exists only once a time has been chosen; before that,
the student is still in the subject booking flow with no booking record. Statuses are
`payment due`, `confirmed`, `completed`, and `cancelled`.
_Avoid_: Reservation, appointment, order, class booking

**Lesson**:
The delivery of a confirmed booking at its scheduled time, online through an attached
meeting link. Product surfaces say lesson (student side) or class (tutor side); both
mean the delivery of one booking.
_Avoid_: Session, meeting, appointment

**Wallet**:
One balance per user holding topped-up money and cleared tutor earnings together. It
funds lesson payments and payouts, and it is the only place money is held. A user who
is both a student and a tutor has one wallet, not two.
_Avoid_: Credits, account balance, points, tutor balance

**Wallet Transaction**:
One movement of money in or out of a wallet, carrying a type, direction, status,
amount, and resulting balance. The transaction ledger is the source of truth for every
balance. Types are top-up, lesson payment, class earning, refund, and payout.
_Avoid_: Payment record, ledger line, charge

**Top-up**:
Real money entering a wallet, paid by PromptPay QR. Top-ups are the only way outside
money enters the platform.
_Avoid_: Deposit, recharge, buying credits

**Lesson Payment**:
The debit that a student makes from wallet balance on the booking page to confirm a
booking. If the balance is short, the booking page sends the student to top up the
difference and come back; the slot stays locked to the booking meanwhile.
_Avoid_: Checkout, transfer proof, invoice

**Earning**:
The tutor's share of a completed lesson, credited to the tutor's wallet after the
platform fee. It is held as pending until it clears, then becomes available balance.
_Avoid_: Income, revenue, salary

**Payout**:
A withdrawal of available wallet balance to a saved payout account. Payouts are not
tutor-only: any user with available balance can request one, including a student who
only topped up.
_Avoid_: Withdrawal request, cash-out, transfer

**Payout Account**:
The bank account a user's payouts are sent to. A user may hold more than one and marks
one as default.
_Avoid_: Payment method, bank details

**Refund**:
A credit returned to a student's wallet when an eligible booking is cancelled or a
dispute is resolved in the student's favour.
_Avoid_: Chargeback, reversal, credit note

**Review**:
A rating and comment a student writes from their own completed booking. A review is
attached to that tutor and that subject, so subject pages show only their own reviews.
A tutor may publicly reply to a review once.
_Avoid_: Feedback, rating, testimonial

**Conversation**:
The message thread between one student and one tutor. A user with both capabilities
switches which side of their conversations they are reading without a second account.
_Avoid_: Chat, inbox, DM

**Report**:
A complaint filed by one user against another, or a flag raised on a review or
message, routed to an admin who keeps, hides, or removes the content and records the
outcome.
_Avoid_: Ticket, complaint, issue

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
