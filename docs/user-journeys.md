# User Journeys — Tutor Matcher

This is the canonical description of what the product does, expressed as the journeys
a user walks and the rules those journeys enforce. It is the requirement-level
companion to [`database-schema.md`](database-schema.md) (what is stored) and
[`CONTEXT.md`](../CONTEXT.md) (what things are called).

## Overview and scope

Tutor Matcher connects tutors and students who match on subject, schedule, and price. A
student opens one of a tutor's subjects, picks a continuous block of that tutor's
published 30-minute slots, and pays from a single wallet balance. Paying confirms the
lesson immediately — there is no tutor approval step, because the tutor already
published the slot.

**Problem.** Finding a tutor who matches a student's subject, schedule, and budget is
usually fragmented and manual, and paying for lessons usually means bank transfers and
screenshots. Tutor Matcher centralises discovery, slot-level booking, and money in one
place.

**Goals.**

1. Let tutors publish a verified public listing, run each teaching offering as its own
   subject with its own rate, and open 30-minute availability slots per subject.
2. Let students search and filter tutors, evaluate a specific subject, book one
   continuous 1-1 block from published availability, and pay from wallet balance.
3. Confirm lessons instantly on payment, deliver them through an attached online meeting
   link, and complete them automatically so settlement and reviewing can start.
4. Hold all money in one wallet per user — top-ups in, lesson payments out, cleared
   earnings in, refunds in, payouts out — with the transaction ledger as the source of
   truth for every balance.
5. Give admins the queues that keep the marketplace trustworthy: tutor applications,
   listing and document changes, flagged content, payment disputes, and account
   suspension.

**Roles.** Every account has the Student capability. Tutor and admin are capabilities
layered onto the same account, not separate account types. A valid server-configured
admin signup key can add the Admin capability during sign-up; an omitted, invalid, or
disabled key leaves the account as a standard Student account.

| Role        | What the capability adds                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Student** | Default for every account: search, message a tutor, book and pay for lessons, attend, review completed lessons, top up                 |
| **Tutor**   | Granted on approved application: public listing, subjects, per-date availability, teaching confirmed classes, wallet earnings, payouts |
| **Admin**   | Tutor applications, listing and document review, content moderation, disputes and refunds, suspension and bans                         |

**In scope:** account sign-up and login; tutor application with identity and
certification documents; admin-reviewed public listings; per-tutor subjects; per-date
30-minute availability with subject assignment; tutor and subject discovery with
filters; subject-locked 1-1 booking of a continuous block; wallet top-up by PromptPay,
wallet-funded lesson payment, earnings, refunds, and payouts for tutors; online lesson
delivery by meeting link and automatic completion; student ⇄ tutor messaging and
notification preferences; reviews scoped to a tutor and a subject, with tutor replies
and flagging; admin queues for applications, moderation, disputes, and account safety.

**Out of scope:** native mobile apps in the initial release, plus the features listed in
[Explicitly out of scope](#explicitly-out-of-scope) below — role selection at sign-up,
recurring bookings, group lessons, lesson credits, saved payment methods, transfer-proof
upload, and tutor promotional posts.

**Team.** Group 2 — G2: ซานต้า. Computer Engineering, Year 2. Kritarat Moonmanee,
Natdanai Hirunsirikul, Teerachot Kerdlapanan, Nontakorn Krairaveeroj, Nonthapat
Sriboonruang, Passatorn Jindawong, Phantakan Thepnakorn, Puntawit Masun, Piranat Wadlom,
Nathawat Wattanarapeepong.

**Evidence.** The behaviour below was taken from the clickable product prototype
(<https://idealkritarat.github.io/tutormatcher-prototype>) and verified by walking it
end to end. The prototype material is preserved under `sources/`:

- [`tutormatcher-prototype-readme.md`](sources/tutormatcher-prototype-readme.md) — page map, flows, and what is real versus faked
- [`tutormatcher-prototype-user-stories.md`](sources/tutormatcher-prototype-user-stories.md) — the product's own epics and acceptance criteria (US1-1 … US11-3)
- [`tutormatcher-prototype.dbml`](sources/tutormatcher-prototype.dbml) — the data model the prototype's scope implies

This page describes the product; GitHub issues describe committed work.

**Contents:** [Overview and scope](#overview-and-scope) · [Route Model](#route-model) ·
[1 · Account and access](#1--account-and-access) ·
[2 · Discovery](#2--discovery) · [3 · Booking a lesson](#3--booking-a-lesson) ·
[4 · Money](#4--money) · [5 · Lesson delivery](#5--lesson-delivery) ·
[6 · Becoming a tutor](#6--becoming-a-tutor) ·
[7 · Tutor operations](#7--tutor-operations) ·
[8 · Messaging and notifications](#8--messaging-and-notifications) ·
[9 · Reviews](#9--reviews) ·
[10 · Admin, trust, and safety](#10--admin-trust-and-safety) ·
[Invariants](#invariants) · [Explicitly out of scope](#explicitly-out-of-scope)

---

## Route Model

Every page in the product maps to one route, and every route carries an access level.
Guards run before render, not after.

| Route                      | Purpose                                                                 | Access         |
| -------------------------- | ----------------------------------------------------------------------- | -------------- |
| `/`                        | Landing page — search box, Find a tutor, Become a tutor                 | Public         |
| `/search`                  | Tutor search with filters and sorting                                   | Public         |
| `/tutors/:id`              | Tutor profile — bio, experience, subject list, recent reviews           | Public         |
| `/tutors/:id/:subjectId`   | One subject — description, rate, format, availability, its reviews      | Public         |
| `/(auth)/login`            | Log in and sign up                                                      | Public         |
| `/forgot-password`         | Request a password reset link                                           | Public         |
| `/reset-password?token=…`  | Validate a reset link and choose a new password                         | Public         |
| `/(auth)/enroll-tutor`     | Tutor application: documents, introduction video, submit, pending state | Requires login |
| `/dashboard`               | Student dashboard; approved Tutors also get a Tutor dashboard tab       | Requires login |
| `/dashboard/tutor`         | Compatibility redirect to `/dashboard?tab=tutor`                        | Redirect       |
| `/bookings`                | All bookings, tabbed by status                                          | Requires login |
| `/bookings/s/:subjectId`   | Subject booking — pick a date and a block of slots (no booking yet)     | Requires login |
| `/bookings/:id`            | One booking — payment, confirmation, meeting link, review               | Requires login |
| `/messages/:id`            | Conversation thread with student ⇄ tutor context switch                 | Requires login |
| `/wallet`                  | Combined ledger: top-ups, lesson payments, earnings, refunds, payouts   | Requires login |
| `/wallet/topup`            | Add money by PromptPay QR (Thai mobile-banking QR payment)              | Requires login |
| `/wallet/payout`           | Request a simulated payout to a saved payout account                    | Requires login |
| `/wallet/transactions/:id` | Read-only transaction detail                                            | Requires login |
| `/settings/account`        | Email, password, deactivate account                                     | Requires login |
| `/settings/notifications`  | Per-event email and push preferences                                    | Requires login |
| `/settings/wallet`         | Balance shortcut and payout account details                             | Requires login |
| `/settings/tutor`          | Tutor profile — public listing, verification, subjects                  | Role: tutor    |
| `/reviews/:tutorId`        | Read-only review list for a tutor                                       | Requires login |
| `/admin/tutor-requests`    | Tutor application queue — approve or reject                             | Role: admin    |

### Access rules

1. A logged-out user opening a `Requires login` route is sent to
   `/(auth)/login?next=<original route>` and returns there after logging in.
   _(Verified: logging out and opening `/bookings` redirects to
   `/(auth)/login?next=bookings.html`.)_
2. A logged-in user who is not an approved Tutor sees only the Student dashboard.
   Requesting `/dashboard?tab=tutor` does not expose the Tutor tab or its tools. A user
   opening `/settings/tutor` before approval is sent to `/(auth)/enroll-tutor`.
3. An approved Tutor opening `/(auth)/enroll-tutor` is sent to `/dashboard?tab=tutor`.
4. The navbar shows **Become a tutor** for Student accounts and applicants; approved
   Tutors and admins do not see that link.
5. Public routes render for logged-out visitors; the header shows **Log in / Sign up**
   instead of the wallet balance and avatar menu.

---

## 1 · Account and access

**Sign up.** Full name, email, password, password confirmation, and agreement to the
Terms and Privacy Policy. There is **no role choice at sign-up** — every new account has
the Student capability. An optional admin signup key adds Admin only when it matches the
key configured by the backend; an omitted, invalid, or disabled key creates a standard
Student account. A duplicate email or invalid input fails with a field-level error.

**Log in / log out.** Email and password, or Continue with Google. Log out returns
protected routes to the guard in rule 1 above.

**Password reset.** Requesting a reset for a registered email sends a time-limited
link. The link is valid for 30 minutes and only once; requesting another link
invalidates earlier links. The request response is the same whether the email belongs
to an account or not. An expired, invalid, cancelled, or already-used link is rejected
with a shared message and the user can request a new one.

Related stories: US1-1 … US1-5.

---

## 2 · Discovery

**Search (`/search`).** Public: logged-out visitors can search, and opening a result
asks them to log in and returns them to that tutor. Each result is **one tutor's subject**,
so a tutor with three subjects shows as three cards; filtering, sorting, counting and
paging all work per subject.

Filters are keyword, tutor name, learning area, price range, minimum rating, and format
(any / online; in-person is deferred with PROF-6). The keyword matches every word against
the subject's name and description; the tutor name matches every word against the tutor's
first or last name. The price range is a two-thumb slider covering the cheapest to the
most expensive listed subject, rounded outward to hundreds (thousands once prices pass
฿10,000); at either end it stops limiting that side. Minimum rating is five stars picked in
half steps, and picking the selected value again clears it.

Sorting is Recommended, Price low to high, Price high to low, and Top rated. Recommended
uses the signed-in Student's selected learning areas when available: 50% area relevance,
30% subject rating and 20% next availability. Relevance is the share of the Student's
selected areas matched by the Subject; rating is the subject's average divided by five.
Availability is `max(0, 1 − wait / 30 days)` for the next open, unbooked slot assigned to
that Subject. Missing ratings and slots score zero. Subjects without a slot in the next
30 days remain in results. When the visitor is logged out, has no Student profile, or has
not selected learning areas, Recommended uses 60% rating and 40% availability.

Recommendation scores are calculated before pagination. Ties use review count, Subject
name, Tutor name and Subject ID for a stable order. Price and Top rated keep their own
sort behavior. A class counts as taught when its booking is completed, or confirmed and
already over. A subject without reviews shows as New and drops out once a minimum rating
is set. Each card shows the
subject name, the tutor's name and **Verified** badge, rating and review count, classes
taught, the start of the subject description, its learning areas, format, hourly rate and
next available time in Bangkok time. Recommended results are private and not shared through
HTTP caches. A signed-in Student in fallback mode can open Student settings to add learning
areas. Goals and preferred learning periods do not currently affect recommendations.
Only subjects of published tutors with an approved profile are listed.

Changing a filter re-filters immediately (typed and dragged fields wait for a short pause)
and returns to page 1; a filter picked during that pause is kept. Results come 12 per page
with Previous and Next, and every filter and the page live in the URL. No match shows an
empty state with one suggestion per active filter to broaden the search, plus Clear all
filters, which also resets the name, price range and rating. The filter rail stays visible
beside the results on desktop.

**Tutor profile (`/tutors/:id`).** Bio, experience, intro video, aggregate rating and
review count, the tutor's subject list with per-subject rate and next opening, and
recent reviews. Each subject links to its own page. Booking cannot start here — the
call to action is **Choose a subject**.

The page is public (`GET /api/discovery/tutors/:id/profile`) and shows the approved
current profile only: bio, rating, each subject's rate, open 30-minute slots over the next
two weeks (Bangkok time), the ten most recent reviews, and the introduction video (YouTube
and Vimeo play inline, video files use a player, other links open separately). A tutor who
is unpublished, has no approved current profile, or does not exist shows an unavailable
message and none of their details. Messaging stays available to logged-in visitors.

**Subject page (`/tutors/:id/:subjectId`).** The bookable unit. It shows that
subject's description, hourly rate, format, and next opening; a month calendar; a day
calendar for the selected day; and **only that subject's reviews**.

The day calendar lays out **all 48 half-hour slots from `00:00` to `23:30`** on a time grid.
Consecutive half-hours open for that subject draw as one `Available` block (for example
`09:00–11:00`); the rest of the day stays empty as `Not available`, and a summary above the
grid lists the open times. Screen readers still hear every half-hour as `Available` or
`Not available`, and the grid opens scrolled to the first open block. The calendar is
informational — it is not the picker. Booking starts from the button below the calendar,
which carries the tutor, subject, rate, and date context.

The page is public (`GET /api/discovery/tutors/:id/subjects/:subjectId?date=YYYY-MM-DD`) under
the same rule as the tutor profile: a published tutor with an approved current profile who owns
the subject; anything else shows an unavailable message and nothing else. The month calendar lets
the Student pick any day from today to three months ahead (Bangkok time); days with openings show
a dot, and without a `date` the page opens on the next opening. The selected day lives in the URL.
A day with no openings shows an empty day calendar, every half-hour `Not available`, and disables
**Book this subject**.
The button links to `/bookings/s/:subjectId?date=YYYY-MM-DD`; a logged-out visitor goes to
login first and returns there with the date. A back link returns to `/tutors/:id`.

Related stories: US3-1 … US3-6.

---

## 3 · Booking a lesson

The booking is a three-step tracker: **Pick time → Payment → Confirmed**.

### Step 1 — Subject booking (`/bookings/s/:subjectId`)

Entered from the subject page with the subject and rate already locked in, so the
student never picks the subject twice. **No booking record exists in this step.**

- A month calendar marks days the tutor has free slots for this subject with a dot;
  days with no slots and days in the past are not selectable. Navigation reaches up to
  **three months ahead**. This is a student calendar-navigation rule, not a limit on how
  far ahead Tutors may publish availability. The existing booking picker/API does not yet
  enforce that navigation horizon; PROF-3 does not add a Tutor publishing cap.
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
- Creating the pending booking writes no wallet row; the amount due is Booking.totalAmount.
- Paying atomically deducts the amount, appends one LESSON_PAYMENT row and changes
  PENDING_PAYMENT to CONFIRMED. Failure leaves the booking and wallet unchanged.
- Cancelling or expiring an unpaid booking writes no wallet row.
- If payment never completes, no confirmed booking exists and the slots are released.

### Step 3 — Confirmed

The booking shows the lesson, when, where (Online), and the meeting link when one is
available, plus what was paid and the payment reference. When the Tutor has supplied a
custom link, it is used for the single **Join lesson** action; otherwise the generated
link is used. A confirmed booking stays confirmed while its link is unavailable.

**There is no tutor accept step.** The tutor published the slot as available, so a paid
booking is auto-confirmed onto the tutor's schedule. If the slot was taken first, the
booking is blocked _before_ payment is captured.

### Step 4 — Completed

The planned completion action atomically changes CONFIRMED to COMPLETED and credits
the tutor's LESSON_EARNING after the fee; see §4. Completion is not implemented by PAY-1.

### Cancellation

Cancelling removes the lesson from the schedule; an eligible refund is credited back to
the student's wallet. The applicable policy is shown before confirmation when the
cancellation falls inside the penalty window. The approved BOOK-3 default refunds 100%
when the lesson is more than 24 hours away, and 70% at exactly 24 hours or less, before
the lesson starts. The confirmation shows the server-calculated fee and refund; if
the terms change, the Student must review and confirm the new quote. See the
[policy confirmation](sources/book-3-policy-confirmation.md).

A Tutor can also cancel a class that has not started (BOOK-4), from **Upcoming classes**
on the Tutor tab of `/dashboard`. The Student is always refunded the full payment, even
inside the 24-hour window; there the Tutor only sees a late-cancellation warning before
confirming, and no money moves from the Tutor. The Tutor must give a reason (up to 500
characters), which the Student sees on the booking with "Your tutor cancelled this lesson".
The freed slots return to the Tutor's calendar closed, not bookable, until the Tutor reopens
them. The Student gets a best-effort booking notification after the cancellation commits.
See the [BOOK-4 confirmation](sources/book-4-policy-confirmation.md).

### `/bookings`

Tabs: **All**, **Upcoming** (confirmed and paid), **Payment due** (slots held, booking
number issued, not yet paid), and **Past** (completed and cancelled). Each row opens
the booking in its correct state.

Related stories: US4-1 … US4-8, US11-1, US11-2.

---

## 4 · Money

All amounts are Thai baht (**฿**). One wallet per user holds topped-up money and cleared
tutor earnings **in the same available balance**. A user who both learns and teaches has
one balance, not two.

| Movement           | Direction | Where it starts                      |
| ------------------ | --------- | ------------------------------------ |
| **Top-up**         | in        | `/wallet/topup` — PromptPay QR       |
| **Lesson payment** | out       | `/bookings/:id` in payment-due state |
| **Lesson earning** | in        | settlement after a completed lesson  |
| **Refund**         | in        | eligible cancellation or dispute     |
| **Payout**         | out       | `/wallet/payout`                     |

**`/wallet`** is the single money page and shows available balance, pending earnings,
earnings this month, and all-time paid out, above one transaction list filterable by
All / Top-ups / Lesson payments / Lesson earnings / Payouts / Refunds. There are no
separate Payments and Earnings pages.

The approved [ledger decision](sources/tutormatcher-wallet-ledger-decision.md) and
[implementation guide](sources/tutormatcher-wallet-ledger-implementation.md) supersede
the earlier pending-transaction design (and the separately supplied PDF).

**Ledger.** One row belongs to one user's wallet and is written only when money moves.
It stores a positive amount, resulting balance, timestamp and optional booking link.
There is no status or direction column: TOP_UP, LESSON_EARNING and REFUND add;
LESSON_PAYMENT and PAYOUT subtract. Entries are never updated or deleted by application
flows; failures and zero movements write no entry.

**`/wallet/transactions/:id`** is read-only history of completed movements.
Unpaid bookings appear only on `/bookings`, not in wallet history.

**Top-up.** Preset or custom amounts followed by simulated confirmation in PAY-1.
The QR is a non-payable demonstration, explicitly labelled; do not send real money.
Success atomically credits balance and appends TOP_UP. Failure writes nothing.
Retrying the same reference cannot credit twice. Simulation is disabled in production;
a verified payment provider is required before real-money use.

**Lesson earnings (planned, outside PAY-1).** Student confirmation of delivery, or
automatic completion 24 hours after the lesson ends, credits the tutor's share and
changes CONFIRMED to COMPLETED atomically. The provisional fee is 15%.
Pending earnings are computed from CONFIRMED bookings minus the fee; no pending
ledger row exists. Until settlement, the money is held by the platform for that booking,
not in the tutor's available wallet.

**Refunds.** Paid cancellation appends REFUND and leaves LESSON_PAYMENT unchanged.
PAY-1 retains the existing configurable cancellation window and late-refund rate,
whose approved defaults are 24 hours and 70%. No late-cancellation tutor share is implemented.
The earlier prototype's 12-hour window is superseded for BOOK-3 by the
[user confirmation](sources/book-3-policy-confirmation.md); late-cancellation allocation
remains separate work.

**Payouts (PAY-7).** A Tutor with available balance can request a payout on
`/wallet/payout`. Payouts are tutor-only: the server rejects anyone else and the page tells
them payouts are for Tutors, and the Request payout button on Wallet settings only shows for
Tutors. Student withdrawals are out of scope. The page shows the available balance and the user's saved payout accounts with
masked account numbers, with the default account picked first. The user enters an amount,
reviews the payout and confirms it. An amount above the available balance is blocked on
the page and by the server. A successful payout appends one PAYOUT row linked to the
payout account and debits the balance in the same serializable transaction; failure writes
nothing. Repeating the same request reference does not pay out twice. The payout is
simulated, labelled "Simulated payout, no real money is transferred", and turned off in
production like top-up. With no saved payout account the page asks the user to add one in
Wallet settings. An asynchronous provider would need a separate request table, not a ledger
status. The full wallet dashboard and lesson completion remain separate work. See the [PAY-7 confirmation](sources/pay-7-policy-confirmation.md).

**Payout accounts (`/settings/wallet`, PROF-7).** Any logged-in user can open Wallet
settings from the Settings navigation, not only Tutors (PROF-7). Requesting a payout is tutor-only (PAY-7).
The page starts with the wallet balance and a **Top up** link to `/wallet/topup`. Below it,
the user's saved payout accounts are listed with bank, account holder name, masked number
(`•••• 1234`). The default has a **Default** badge, the others a **Set default** action,
and every row has **Remove**, which asks for an inline confirm. An **Add account** form takes a Thai bank from the list, the account
holder name and a 10 to 15 digit account number (spaces and dashes are ignored). A user can
save up to 5 accounts. The first one becomes the default, and a new one replaces the default
only when the user ticks **Make this my default account**. Exactly one account is the
default, and payouts use it unless the user picks another. The full number is never shown
again after saving. Accounts cannot be edited: the user removes one and adds it again, so
past payouts keep the account they were sent to. Removing the default makes the oldest
remaining account the default. The same bank and number can't be saved twice while active,
and adding or removing accounts is rate limited per user. See the [PROF-7 confirmation](sources/prof-7-policy-confirmation.md).

Related stories: US5-1 … US5-8, US11-3.

---

## 5 · Lesson delivery

A confirmed online booking shows its effective meeting link on `/bookings/:id` to both
participants. The assigned Tutor can add, replace, or remove a custom HTTPS link until
the scheduled lesson end. A custom link takes priority over the generated-link field;
removing it restores the generated link when one is available. The booking page shows
the latest editor and change time, without a full history. The app offers Join as soon
as a confirmed booking has a link and until its scheduled end; cancelled and completed
bookings have no Join action. Links are not checked with their provider. The Tutor's
view additionally shows the student, the subject, the format, the lesson description
the student wrote, the duration, and the payout for that class.

Google Meet room creation and its recovery are not implemented in this slice. Until a
later provider integration replaces the existing generated-link field, a Tutor-provided
link can be used independently of generated meeting creation.

Joining before the room opens explains when it opens or opens the configured waiting
room. Planned completion follows the ledger rule in §4: student confirmation or the
clearing deadline. Dispute handling and completion automation are outside PAY-1.

Related stories: US6-1 … US6-3.

---

## 6 · Becoming a tutor

1. A logged-in student opens **Become a tutor** → `/(auth)/enroll-tutor`.
2. The application requires a bio, an identification card document and an introduction video.
   Portfolio certifications are not collected for now, because document upload and storage
   are deferred. Pressing Submit while a required field is missing blocks submission and
   highlights the missing fields. Subjects are not part of the application — they are added
   afterwards in `/settings/tutor`.
3. A student can save multiple incomplete **drafts** and see them in a list. **New draft** starts empty; it
   and each row's **Edit** button open a modal for one draft at a time. Each row has a
   **Trash** icon to delete that saved draft after confirmation, an **Edit** icon and a
   **Submit** action. Submitting asks for confirmation explaining the one-pending-request
   limit and withdrawal, with consent inside confirmation and an Edit draft action to return
   to the shared editor. Confirmation replaces the editor modal. The modal has a sticky
   **Draft** header with Saved / Not saved status beside it and a close button, with
   **Save draft** and **Submit** in its sticky footer. Fields sit directly in the modal.
   Closing with unsaved changes replaces the editor with Save or Discard; × reopens the same form. Discard drops only unsaved
   changes; saved drafts remain in the list. Submission saves the selected content, validates all required
   fields and consent, then sets that version to **pending**. There is at most one
   pending version per user. Other drafts remain editable while a request is pending,
   but another submission is blocked until review or withdrawal. Submitted content is
   fixed; **Withdraw request** cancels it without creating a draft. The owner sees pending,
   approved, rejected and cancelled submissions as compact expandable rows in **Submission history**.
   Pending Verification and its Withdraw action are inside that list, with no separate pending panel.
   A reload icon sits at the top-right of Submission history. **Create draft from
   cancelled submission** (or **rejected submission**) explicitly copies its content into a
   new saved draft with a new ID; the source submission and other drafts remain unchanged.
   The page shows the pending documents and introduction video separately from drafts.
4. While pending the user is still a Student: the Tutor tab is absent from `/dashboard`,
   and `/settings/tutor` bounces back to the application. The legacy `/dashboard/tutor`
   URL redirects to `/dashboard?tab=tutor`, where the user still sees only the Student
   dashboard.
5. An admin compares proposed and current content at `/admin/tutor-requests`. Initial
   approval creates a Tutor as **unpublished**, linked to the approved version on the
   same User account, and grants a **Verified** badge. The tutor chooses when to publish.
   Rejection requires a reason displayed to the applicant and emailed to them. **Revise and
   re-submit** copies the rejected request into a new draft; revised submissions create new
   versions. Review outcomes are visible in the application/settings UI.
   Approval is blocked while the identification card URL, or a certification URL from earlier
   data, ends in a file extension other than `.pdf`, `.jpg`, `.jpeg`, `.png` or `.webp`; the
   admin sees which file and rejects with a reason instead. A URL without an extension is left
   to the admin to check.
6. After approval, the application shows the approved Tutor and links to Tutor settings
   and `/dashboard?tab=tutor`. The user chooses when to publish.

Related stories: US1-4, US9-1.

---

## 7 · Tutor operations

**Dashboard (`/dashboard`).** Every logged-in user sees the Student dashboard, including
Student profile setup and learning links. Only approved Tutors see the Student and Tutor
tabs; Student accounts and pending applicants never receive Tutor dashboard content. The
Tutor tab contains **Upcoming classes** (BOOK-4: each class that has not started, with its
student and time, opening `/bookings/:id`), the availability editor and links to `/settings/tutor`, which owns
subject and listing management. The navbar keeps **Become a tutor** visible for Student
accounts and applicants.

**Tutor dashboard (Tutor tab on `/dashboard`).** Ordered by operational priority: compact
stat cards (classes this week, earnings this month, paid bookings, rating), then the wallet
and earnings preview, then **Upcoming classes** ("what you need to teach next", each
with View and Start), then **New paid bookings** ("already confirmed from your
availability"), then subjects, then the availability editor. Long sections scroll
inside their own card rather than pushing the page. Subject **Update** links to
`/settings/tutor`, which owns subject editing. The former `/dashboard/tutor` URL redirects
to `/dashboard?tab=tutor` for existing links and bookmarks.

**Tutor profile (`/settings/tutor`).** Available from the shared Settings navigation as
**Tutor profile**. Published toggle, photo, display name, headline, bio,
and intro video URL, then **Verification** (document state and Replace documents), then
**Subjects**. Listing and document changes are **submitted for review** and only go live
once an admin approves; a rejection leaves the live listing untouched and returns a
reason, and the Tutor can revise the rejected request in a copied draft. Submit is disabled
when nothing changed. Approval switches the current profile
version immediately, preserving the publication setting at that moment. The submit
UI explains this automatic application. A draft list has Edit and Trash icons and a Submit action.
Creating or editing a draft opens a modal with a sticky header and Save draft / Submit footer.
Only one draft is edited at a time; closing with unsaved changes offers Save or Discard, with × to return to editing.
Discard drops unsaved edits; the list's Trash action deletes a saved draft after confirmation.
Portfolio certifications are not collected (see §6); saving a draft clears any it carried over.
Other drafts stay editable during review; only a second submission is blocked. Submit
confirmation explains the pending limit and cancellation. Withdrawal only cancels the submitted
version; its immutable content stays visible in submission history. The tutor can explicitly
create a separate draft from a cancelled or rejected submission, copying all content.
Pending and approved versions remain immutable history. Account names are edited in Account settings,
not as part of a profile review.

**Unpublishing.** Hide the tutor and subjects from search/recommendations and reject
new bookings on the backend. Direct tutor/booking-subject links show that the tutor
is not accepting bookings. Existing subject details, conversations, booked lessons,
and tutor management access remain available. Search/recommendation and subject
management pages that are placeholders are not implemented by AUTH-4.

**Verification privacy.** Student-facing tutor pages show approved public content and the
Verified badge. Identification-card URLs remain restricted to their owner and authorized
admins. The API still returns approved portfolio certification URLs from earlier data, but no
page shows them.

**Subjects.** Each subject is its own offering with a name, description, hourly rate,
format, and one to three learning areas. The name is free text; the learning areas come
from the same fixed list students pick at onboarding (including **Other**) and are how
search finds the subject. PROF-6 currently supports **Online** only; in-person offerings and venues
are deferred. Adding starts as a single **Add subject** button that opens the form;
editing happens inline on the selected subject row. The Subjects section sits below
Verification. Name and description are required (up to 100 and 2000 characters respectively).
Rates are positive Thai baht amounts with at most two decimal places, up to ฿99,999,999.99.
Duplicate names are allowed: each offering has its own identity.

Subject saves take effect immediately and independently of profile review, including
while an approved Tutor is unpublished or has a profile edit awaiting review. Only the
owning Tutor can create or edit their offerings. Cancel discards unsaved form changes.
Publication continues to control discovery and new bookings.

A booking captures its subject name, description, hourly rate and format when it is
created. Later subject edits affect future bookings while existing bookings retain
those details and their stored total price. For older bookings without snapshots, the
first subject edit preserves the currently stored details before changing the offering;
values already overwritten before this feature cannot be recovered.

**Availability.** The tutor selects a dated cell in a seven-day calendar, opens the
30-minute slot they can teach, and
assigns which subject(s) each open slot covers — so one slot can advertise several
subjects and a student browsing a subject sees only slots that carry it. Slots already
attached to a paid booking or an active payment hold are **locked** and cannot be closed
or reassigned. Subject assignment uses
compact toggle boxes that scroll inside their own area. Availability is per date, not a
recurring weekly pattern. Approved Tutors can manage it while unpublished; publication
still controls new bookings.

The availability editor on `/dashboard` shows seven dated day columns with all
48 half-hours, from `00:00` to `23:30`, in **Asia/Bangkok (UTC+7)**. A month overview
summarizes availability; clicking a date opens its week for slot editing. Tutors may
open any future date, close free future
slots, and change their subject assignments. An open slot requires at least one owned
subject. The same Tutor cannot have overlapping slots, including across different subjects.
Past slots are read-only. Expired payment holds release through the booking lifecycle.

Each slot has its own **Save slot** and **Close slot** actions. There is no day or week
save step. If another edit or booking changes that slot, its save is rejected and its draft
stays in the editor. The Tutor can review the latest value and explicitly retry if it is
still free and in the future. Changes to a different slot do not invalidate this slot's
revision. Changing the selected slot or calendar view requires saving or explicitly
discarding its unsaved edits. Save and network errors preserve the draft.

PROF-3 delivers this editor and APIs for existing booking and later discovery integration.
It does not deliver the search or subject-detail pages, nor the other planned Tutor
dashboard sections.

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

**Admin submission history.** `/admin/tutor-requests` uses compact expandable rows showing
applicant name/email, status and submission date. The list box has a reload icon on the
left and status filter on the top-right. It defaults to Pending and can filter
Approved, Rejected, Cancelled or All submissions. Unsent drafts are never included.
Past submissions show their exact content, submitted/review dates and rejection reason
where applicable, with no approval or rejection controls. Pending requests retain the
current-versus-proposed comparison and review actions when expanded; a pending request
with an unsupported verification file lists those files and disables Approve. Owner and admin
lists share status badges: amber for Pending Verification, green for Approved, red for
Rejected and gray for Cancelled. Reload icons have accessible labels and tooltips.

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
   has one owner, a type, positive amount and resulting balance, with no status or
   direction column. The shared writer updates the balance and appends the row atomically;
   balances are never edited independently of the ledger.
9. **Payouts are tutor-only.** A Tutor can pay out available balance; students cannot withdraw.
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
