# User Journeys — Tutor Matcher

This is the canonical description of what the product does, expressed as the journeys
a user walks and the rules those journeys enforce. It is the requirement-level
companion to [`project-schema.md`](project-schema.md) (what is stored) and
[`CONTEXT.md`](../CONTEXT.md) (what things are called).

**Evidence.** The behaviour below was taken from the clickable product prototype and
verified by walking it end to end. The prototype material is preserved under
`sources/`:

- [`tutormatcher-prototype-readme.md`](sources/tutormatcher-prototype-readme.md) — page map, flows, and what is real versus faked
- [`tutormatcher-prototype-user-stories.md`](sources/tutormatcher-prototype-user-stories.md) — the product's own epics and acceptance criteria (US1-1 … US11-3)
- [`tutormatcher-prototype.dbml`](sources/tutormatcher-prototype.dbml) — the data model the prototype's scope implies

Where this page and the product backlog disagree, the disagreement is listed in
[`backlog/reconciliation.md`](backlog/reconciliation.md); this page describes the
product, the backlog describes committed work.

---

## Route Model

Every page in the product maps to one route, and every route carries an access level.
Guards run before render, not after.

| Route                      | Purpose                                                               | Access         |
| -------------------------- | --------------------------------------------------------------------- | -------------- |
| `/`                        | Landing page — search box, Find a tutor, Become a tutor               | Public         |
| `/search`                  | Tutor search with filters and sorting                                 | Public         |
| `/tutors/:id`              | Tutor profile — bio, experience, subject list, recent reviews         | Public         |
| `/tutors/:id/:subjectId`   | One subject — description, rate, format, availability, its reviews    | Public         |
| `/(auth)/login`            | Log in and sign up                                                    | Public         |
| `/(auth)/enroll-tutor`     | Tutor application: documents, bio, submit, pending state              | Requires login |
| `/dashboard`               | Student dashboard                                                     | Requires login |
| `/dashboard/tutor`         | Tutor dashboard — classes, earnings, bookings, subjects, availability | Role: tutor    |
| `/bookings`                | All bookings, tabbed by status                                        | Requires login |
| `/bookings/s/:subjectId`   | Subject booking — pick a date and a block of slots (no booking yet)   | Requires login |
| `/bookings/:id`            | One booking — payment, confirmation, meeting link, review             | Requires login |
| `/messages/:id`            | Conversation thread with student ⇄ tutor context switch               | Requires login |
| `/wallet`                  | Combined ledger: top-ups, lesson payments, earnings, refunds, payouts | Requires login |
| `/wallet/topup`            | Add money by PromptPay QR                                             | Requires login |
| `/wallet/transactions/:id` | Read-only transaction detail                                          | Requires login |
| `/settings/account`        | Email, password, deactivate account                                   | Requires login |
| `/settings/notifications`  | Per-event email and push preferences                                  | Requires login |
| `/settings/wallet`         | Balance shortcut and payout account details                           | Requires login |
| `/settings/tutor`          | Public listing, verification, subjects                                | Role: tutor    |
| `/reviews/:tutorId`        | Read-only review list for a tutor                                     | Requires login |
| `/admin/tutor-requests`    | Tutor application queue — approve or reject                           | Role: admin    |

### Access rules

1. A logged-out user opening a `Requires login` route is sent to
   `/(auth)/login?next=<original route>` and returns there after logging in.
   _(Verified: logging out and opening `/bookings` redirects to
   `/(auth)/login?next=bookings.html`.)_
2. A logged-in user who is not an approved tutor opening a `Role: tutor` route is sent
   to `/(auth)/enroll-tutor`.
3. An approved tutor opening `/(auth)/enroll-tutor` is sent to `/dashboard/tutor`.
4. Until a user is approved, tutor links rendered on any page point at the tutor
   application instead of the tutor page.
5. Public routes render for logged-out visitors; the header shows **Log in / Sign up**
   instead of the wallet balance and avatar menu.

---

## 1 · Account and access

**Sign up.** Full name, email, password, password confirmation, and agreement to the
Terms and Privacy Policy. There is **no role choice at sign-up** — every new account is
a student. A duplicate email or invalid input fails with a field-level error.

**Log in / log out.** Email and password, or Continue with Google. Log out returns
protected routes to the guard in rule 1 above.

**Password reset.** Requesting a reset for a registered email sends a time-limited
link. An expired or already-used link is rejected and the user can request a new one.

Related stories: US1-1 … US1-5.

---

## 2 · Discovery

**Search (`/search`).** Filters are keyword, subject, maximum hourly price, minimum
rating, and format (any / online / in-person). Sorting is Recommended, Price low to
high, Price high to low, and Top rated. Results show the tutor's name, headline,
rating and review count, subject tags, format, hourly rate, and either a **Verified**
badge or a location tag. Changing a filter re-filters immediately; no match shows an
empty state. The filter rail stays visible beside the results on desktop.

**Tutor profile (`/tutors/:id`).** Bio, experience, intro video, aggregate rating and
review count, the tutor's subject list with per-subject rate and next opening, and
recent reviews. Each subject links to its own page. Booking cannot start here — the
call to action is **Choose a subject**.

**Subject page (`/tutors/:id/:subjectId`).** The bookable unit. It shows that
subject's description, hourly rate, format, and next opening; a calendar; the
availability table for the selected day; and **only that subject's reviews**.

The availability table renders **all 48 half-hour slots from `00:00` to `23:30`**, each
marked `Available` or `Not available` for that subject. The rows are informational —
they are not the picker. Booking starts from the button below the table, which carries
the tutor, subject, rate, and date context.

Related stories: US3-1 … US3-6.

---

## 3 · Booking a lesson

The booking is a three-step tracker: **Pick time → Payment → Confirmed**.

### Step 1 — Subject booking (`/bookings/s/:subjectId`)

Entered from the subject page with the subject and rate already locked in, so the
student never picks the subject twice. **No booking record exists in this step.**

- A month calendar marks days the tutor has free slots for this subject with a dot;
  days with no slots and days in the past are not selectable. Navigation reaches up to
  **three months ahead**.
- Choosing a day reveals the 48 half-hour slots; only slots the tutor opened for this
  subject are selectable.
- Slots are chosen as **one continuous block**. A tap extends the block at either end
  or removes an end slot. A non-adjacent tap is rejected with _"Pick slots that are
  back-to-back"_ and the selection restarts from that slot.
- The summary shows the selected window, the duration, and the price. **Price = number
  of 30-minute slots × hourly rate ÷ 2.**
- A free-text note — _"What do you want to learn?"_ — is captured for the tutor.
- There is no weekly or recurring option, and no way to add another student.

### Step 2 — Payment due (`/bookings/:id`)

Continuing creates the booking record and its booking number, and opens the booking
page with the subject, date, time, duration, and price locked. The tutor's slots are
locked to this booking while payment is outstanding.

- Payment is a debit from **wallet balance**, taken on this page. Wallet history never
  accepts payment.
- If the balance is short, the page states the shortfall, disables **Pay**, and offers
  **Top up ฿<shortfall>**, returning the student to this booking afterwards.
- Paying deducts the amount and confirms the booking immediately.
- If payment never completes, no confirmed booking exists and the slots are released.

### Step 3 — Confirmed

The booking shows the lesson, when, where (Online · Zoom), and the **meeting link**,
plus what was paid and the payment reference. Actions are Join, Message the tutor, and
Cancel.

**There is no tutor accept step.** The tutor published the slot as available, so a paid
booking is auto-confirmed onto the tutor's schedule. If the slot was taken first, the
booking is blocked _before_ payment is captured.

### Step 4 — Completed

After delivery the booking becomes `completed`, which starts settlement and unlocks
reviewing.

### Cancellation

Cancelling removes the lesson from the schedule; an eligible refund is credited back to
the student's wallet. The applicable policy is shown before confirmation when the
cancellation falls inside the penalty window. The product's stated default is free
cancellation up to 12 hours before the lesson.

### `/bookings`

Tabs: **All**, **Upcoming** (confirmed and paid), **Payment due** (slots held, booking
number issued, not yet paid), and **Past** (completed and cancelled). Each row opens
the booking in its correct state.

Related stories: US4-1 … US4-8, US11-1, US11-2.

---

## 4 · Money

One wallet per user holds topped-up money and cleared tutor earnings **in the same
available balance**. A user who both learns and teaches has one balance, not two.

| Movement           | Direction | Where it starts                      |
| ------------------ | --------- | ------------------------------------ |
| **Top-up**         | in        | `/wallet/topup` — PromptPay QR       |
| **Lesson payment** | out       | `/bookings/:id` in payment-due state |
| **Class earning**  | in        | settlement after a completed lesson  |
| **Refund**         | in        | eligible cancellation or dispute     |
| **Payout**         | out       | `/wallet` → Request payout           |

**`/wallet`** is the single money page and shows available balance, pending earnings,
earnings this month, and all-time paid out, above one transaction list filterable by
All / Top-ups / Lesson payments / Class earnings / Payouts / Refunds. There are no
separate Payments and Earnings pages.

**`/wallet/transactions/:id`** is read-only history. A lesson payment that has not
completed points the user back to `/bookings/:id` to pay; it never accepts payment
itself.

**Top-up.** Preset amounts or a custom amount, then a PromptPay QR. Balance increases
and a transaction is recorded only when payment is confirmed.

**Earnings.** A completed lesson credits the tutor's share to the wallet. The platform
takes a **15% fee**, so a ฿520 lesson credits ฿442. The earning is held as **pending**
until it clears — stated as 24 hours after the lesson — and is excluded from available
balance until then.

> The 15% fee, the 24-hour clearing period, and the 12-hour free-cancellation window
> below are read off prototype copy. The mechanism is settled; the **numbers still need
> product sign-off**. Do not treat them as final policy.

**Payouts.** Any user with available balance can withdraw to a saved payout account —
**payouts are not tutor-only**. The amount leaves the wallet and is recorded as a debit
transaction linked to the payout account. A request above available balance is blocked.
Payout accounts are managed in `/settings/wallet`.

Related stories: US5-1 … US5-8, US11-3.

---

## 5 · Lesson delivery

A confirmed online booking gets a meeting link, visible to the student on
`/bookings/:id` and to the tutor in the tutor view of the same booking. The tutor's
view additionally shows the student, the subject, the format, the lesson description
the student wrote, the duration, and the payout for that class.

Joining before the room opens explains when it opens or opens the configured waiting
room. After delivery the system marks the booking `completed` when attendance meets the
completion rules; otherwise completion is blocked or flagged for review.

Related stories: US6-1 … US6-3.

---

## 6 · Becoming a tutor

1. A logged-in student opens **Become a tutor** → `/(auth)/enroll-tutor`.
2. The application requires **all three**: a government ID document, a teaching
   certification document, and a bio. Submit stays disabled until all three are
   present. Subjects are not part of the application — they are added afterwards in
   `/settings/tutor`.
3. Submitting sets the application to **pending**. The page then shows the uploaded
   documents, the bio state, and _Awaiting approval_, with **Cancel & re-submit**.
4. While pending the user is still a student: `/dashboard/tutor` and `/settings/tutor`
   bounce back to the application.
5. An admin approves or rejects at `/admin/tutor-requests`. Approval grants the tutor
   capability; rejection notifies the applicant with a reason.
6. After approval, `/(auth)/enroll-tutor` redirects to `/dashboard/tutor`.

Related stories: US1-4, US9-1.

---

## 7 · Tutor operations

**Tutor dashboard (`/dashboard/tutor`).** Ordered by operational priority: compact stat
cards (classes this week, earnings this month, paid bookings, rating), then the wallet
and earnings preview, then **Upcoming classes** ("what you need to teach next", each
with View and Start), then **New paid bookings** ("already confirmed from your
availability"), then subjects, then the availability editor. Long sections scroll
inside their own card rather than pushing the page. Subject **Update** links to
`/settings/tutor`, which owns subject editing.

**Listing (`/settings/tutor`).** Published toggle, photo, display name, headline, bio,
and intro video URL, then **Verification** (document state and Replace documents), then
**Subjects**. Listing and document changes are **submitted for review** and only go live
once an admin approves; a rejection leaves the live listing untouched and returns a
reason. Submit is disabled when nothing changed.

**Subjects.** Each subject is its own offering with a name, description, hourly rate,
and format. Adding starts as a single **Add subject** button that opens the form;
editing happens inline on the selected subject row. The Subjects section sits below
Verification.

**Availability.** The tutor picks a day, opens the 30-minute slots they can teach, and
assigns which subject(s) each open slot covers — so one slot can advertise several
subjects and a student browsing a subject sees only slots that carry it. Slots already
attached to a paid booking are **locked** and cannot be closed. Subject assignment uses
compact toggle boxes that scroll inside their own area. Availability is per date, not a
recurring weekly pattern.

Related stories: US2-3, US2-4, US2-5, US2-7, US10-2, US10-3.

---

## 8 · Messaging and notifications

A student can message a tutor before booking, from the tutor or subject page. `/messages/:id`
fills the viewport with a conversation list and the open thread; unread messages put a
marker on the Messages navigation link on every other page. A user with both
capabilities flips the **Student ⇄ Tutor** switch to change which side of their
conversations they are reading, without leaving the page and without a second account.

Notification preferences (`/settings/notifications`) are a grid of **Email** and **Push**
per event group: booking updates, lesson reminders (1 hour and 10 minutes before start),
new messages, wallet and payments, and product news. A disabled event type is skipped at
dispatch.

Related stories: US7-1 … US7-3, US2-2.

---

## 9 · Reviews

- A review can only be written **from the reviewer's own completed booking** on
  `/bookings/:id`. Attempting to review a lesson that is not completed is blocked.
- A review carries a star rating (1–5), an optional headline, and text, and is attached
  to the tutor **and the subject**.
- `/tutors/:id/:subjectId` shows only that subject's reviews; `/tutors/:id` shows recent
  reviews across subjects with a link to write one from a completed booking.
- `/reviews/:tutorId` is a read-only list with a rating distribution summary. It never
  accepts a new review.
- A tutor may reply publicly to a review; the reply appears under it.
- Any user can flag a review with a reason, which sends it to admin moderation. A
  duplicate flag from the same user is rejected.

Related stories: US8-1 … US8-4.

---

## 10 · Admin, trust, and safety

| Queue                        | Admin decision                                                    |
| ---------------------------- | ----------------------------------------------------------------- |
| Tutor applications           | Approve → tutor capability granted · Reject → applicant told why  |
| Listing and document changes | Approve → public listing updates · Reject → tutor revises         |
| Flagged reviews and messages | Keep, hide, or remove, with an audit trail                        |
| Payment disputes and refunds | Resolve, and the wallet ledger reflects the decision              |
| Policy violations            | Suspend or ban; protected actions are blocked with a reason shown |

Related stories: US9-1 … US9-5.

---

## Invariants

Rules that are easy to break when building a slice in isolation:

1. **One account, layered capabilities.** Student is the default; tutor and admin are
   added to the same account. Never model a student account and a tutor account as
   different records.
2. **A subject is the bookable unit,** not the tutor and not a "class".
3. **Availability belongs to the tutor, subjects are assigned to slots.** A slot is not
   owned by one subject.
4. **A booking is 1-1 and one continuous block.** No group booking, no invitations, no
   recurring or weekly plans.
5. **No booking record exists until a time is chosen.** `/bookings/s/:subjectId` has no
   booking id.
6. **Payment confirms the booking; the tutor never accepts.** A slot published as
   available is a commitment.
7. **A paid slot is locked to exactly one booking.** Double-booking must be blocked
   before payment capture, not compensated afterwards.
8. **The wallet transaction ledger is the source of truth for money.** Every movement
   has a type, direction, status, amount, and resulting balance; balances are derived,
   never edited directly.
9. **Payouts are available to any user with balance,** not only tutors.
10. **Reviews come only from a completed booking** and are scoped to tutor + subject.
11. **Listing and verification changes are admin-reviewed before going live.**

---

## Explicitly out of scope

These do not exist in the product and should not be built or documented as if they do:

- Role selection at sign-up
- Recurring, weekly, or package bookings
- Group lessons, classmate invitations, or invitation acceptance
- Lesson credit or package purchases (money is held in baht in the wallet)
- Stored card or saved payment methods for top-up (top-up is PromptPay QR)
- Bank-slip transfer-proof upload and manual payment verification
- Tutor promotional posts
- A separate tutor Earnings page distinct from `/wallet`
