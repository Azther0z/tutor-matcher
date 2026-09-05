---
type: raw
source: https://github.com/Azther0z/tutormatcher-prototype
collected: 2026-09-05
published: null
---

# TutorMatcher — HTML Prototype

A clickable, no-backend prototype of the product. 18 HTML pages, one shared stylesheet,
one shared script. Open it and use it: log in, browse tutors, open subject-specific tutor
pages, inspect availability, build a 1-1 booking slot by slot, pay immediately from a
unified wallet, top that wallet up with a fake PromptPay QR, and request payouts. Every
screen shows, in the dark bar up top, what URL it would be on the real site.

The prototype persists a few client-side values in `localStorage`: login state, tutor role,
wallet balance, tutor subjects, tutor availability, and tutor listing drafts. Hard-coded
messages, bookings, reviews, and ledger examples reset on reload. It's a UI prototype for
click-testing flows and layout, not a working app.

## File structure

```
prototype/
├─ index.html                    → /                    minimal home (hero + Find a tutor / Become a tutor)
├─ login.html                    → /(auth)/login        one flag → the app pages open
├─ enroll-tutor.html             → /(auth)/enroll-tutor apply to be a tutor: upload docs → pending → approved
├─ admin.html                    → /admin/tutor-requests prototype console — approve your own tutor request
├─ search.html                   → /search
├─ tutor-detail.html             → /tutors/:id and /tutors/:id/:subjectId
├─ dashboard-student.html        → /dashboard           full-width Student ⇄ Tutor switch
├─ dashboard-tutor.html          → /dashboard/tutor    TUTORS ONLY · requests, schedule, availability editor
├─ booking-detail.html           → /bookings/s/:subjectId and /bookings/:id subject booking, payment, status, Zoom link
├─ bookings.html                 → /bookings            all your bookings — tabs: All / Upcoming / Payment due / Past
├─ payments.html                 → /wallet              combined wallet ledger: top-ups, lesson payments, earnings, payouts
├─ payment-detail.html           → /wallet/transactions/:id read-only wallet transaction history
├─ topup.html                    → /wallet/topup        add real money to the wallet (QR)
├─ messages.html                 → /messages/:id        fills the viewport, no page scroll; Student ⇄ Tutor switch
├─ settings-account.html         → /settings/account
├─ settings-notifications.html   → /settings/notifications
├─ settings-tutor.html           → /settings/tutor      public tutor listing (bio, rate, subjects, verification)
├─ settings-wallet.html          → /settings/wallet     balance, payout account, wallet shortcut
├─ earnings.html                 → legacy tutor earnings detail; /wallet is the primary money page
├─ reviews.html                  → /reviews/:tutorId    read-only list (writing lives on a completed booking)
├─ USER_STORIES.md               → YAML user stories for the real product
├─ tutormatcher.dbml             → database diagram/model for the real product
├─ _shared.css                   → design tokens + every component style
└─ _app.js                       → shared behaviour (auth, wallet, toasts, tabs, chat, pickers…)
```

No build step, no dependencies. Open `index.html` directly, or serve the folder
(`python3 -m http.server`, VS Code Live Server, etc.).

For GitHub Pages, keep `.nojekyll` in the repo. The prototype uses `_shared.css` and
`_app.js`; without `.nojekyll`, Jekyll can skip underscore-prefixed files and the hosted
site will load without CSS/JS.

## Shell: one header, login/logout, and the role switch

- **Every page uses the same header component**: brand · `Dashboard · Find tutors ·
  Bookings · Messages` · then either **Log in / Sign up** (logged out) or the **wallet
  pill + avatar menu** (logged in, with Settings / Top up / Admin / Log out). The logo
  always goes to `/`.
- **Account state** — two `localStorage` keys, both cleared on **Log out** (so a fresh
  login is a brand-new account):
  - `tm_auth` — `''` logged out · `'user'` logged in. Everyone logs in as a plain student.
  - `tm_tutor` — `''` not a tutor · `'pending'` applied, awaiting admin · `'approved'` tutor.
- **Becoming a tutor**: "Become a tutor" → `/(auth)/enroll-tutor` → upload ID +
  certification and add a bio → **submit** (`tm_tutor = pending`). Subjects are managed later
  in `/settings/tutor`. While pending
  you can re-open that page to **cancel & re-submit**. `/admin/tutor-requests` shows the
  one request with **Approve / Reject**; approving sets `tm_tutor = approved`. After that,
  `/(auth)/enroll-tutor` just redirects to `/dashboard/tutor`.
- **Route guards** (`_app.js`, run before render):
  - `data-requires-auth` → logged out ⇒ `login.html?next=…`
  - `data-requires-tutor` (on `/dashboard/tutor`, `/settings/tutor`) → not approved ⇒ `enroll-tutor.html`
  - `data-redirect-if-tutor` (on `enroll-tutor`) → already a tutor ⇒ `/dashboard/tutor`
  - until you're approved, every "tutor" link on the page is rewritten to `enroll-tutor.html`.
- The **Student ⇄ Tutor switch** navigates between `/dashboard` and `/dashboard/tutor`
  (non-tutors land on the application). On messages the same switch flips which side you're
  chatting as without leaving the page.
- The real route label shown in the top bar is part of the prototype navigation model.
  In the real app it should act as a page switcher/dropdown for reviewers, with route
  access tags like `Public`, `Requires login`, `Role: tutor`, and `Role: admin`.
- Unread messages put a red dot on the Messages nav link (every page except that one).

## The booking flow

`Book a lesson` starts from a tutor subject page. `/tutors/:id` shows the tutor, while
`/tutors/:id/:subjectId` shows that subject's details, subject-only reviews, and a
subject-only availability calendar. On the subject page, selecting a date shows every
30-minute slot from `00:00` through `23:30` as `Available` or `Not available`; the slots
are informational, and the booking button below the slot table starts a subject-locked
flow at `/bookings/s/:subjectId`.

From there:

1. **Subject booking** — `/bookings/s/:subjectId` shows a **month calendar** (‹ › to change month, up to 3 months out) with a dot
   on days the tutor has free for that subject; pick one, then tap **back-to-back** 30-minute slots.
   Non-adjacent slots are rejected; there's no weekly option and no group booking — one
   booking is one continuous 1-1 block. This step has no `booking_id` yet.
2. **Payment due** — choosing time creates the `booking_id` and opens `/bookings/:id`
   immediately with the subject, date, time, and price locked. Payment happens on this
   booking page and deducts straight from your **wallet balance**. There is no tutor accept
   step because the tutor already published that slot as available.
3. **Confirmed** — paid; the lesson is locked in and `/bookings/:id` shows the Zoom link
   for students and tutors.
4. **Completed** — after the lesson, this is the **only place to write a review** (star
   rating + comment, posts to the tutor's profile). `/reviews/:tutorId` is a read-only
   list; `/tutors/:id` shows recent reviews with a link back here to write one.

`booking-detail.html` renders whichever state is in `?s=` (`draft` default in the prototype). In the real
route model, subject booking is `/bookings/s/:subjectId`; payment due and confirmed
states are `/bookings/:id`. A
"jump to state" selector on the page lets you preview each one. The `/bookings` list links
each row to the right state.

`/bookings` tabs (combined where it made sense):

| Tab      | Contains                                                                  |
| -------- | ------------------------------------------------------------------------- |
| All      | every booking, any status                                                |
| Upcoming | confirmed, paid lessons                                                   |
| Payment due | slots already chosen, booking ID created, waiting for payment        |
| Past     | completed and cancelled lessons                                         |

## The wallet

Real money enters at **`/wallet/topup`** and cleared tutor earnings enter the same wallet
balance. `/wallet` is the combined ledger for top-ups, lesson payments, class earnings,
refunds, and payout withdrawals. Payouts are not tutor-only: any user can withdraw
available wallet balance to a saved payout account, including a student who only topped
up. Lesson payments spend that balance from `/bookings/:id`; if it's short, the booking
page sends you to `/wallet/topup` for the difference. `/wallet/transactions/:id` is
read-only history/receipt detail. If a lesson payment is not complete yet, that transaction
page points back to `/bookings/:id` instead of accepting payment there. `/settings/wallet`
holds wallet settings and payout account details.

## Dashboards and settings

`/dashboard` keeps the student view focused on upcoming lessons/classes, wallet balance,
and learning progress without oversized quick-action blocks. `/dashboard/tutor` puts the
important operational work first: compact stat cards, wallet/earnings preview, upcoming
classes, new paid bookings, then subjects. Long upcoming-class, new-booking, and subject
sections scroll inside the card instead of pushing the entire page.

Settings pages keep the top navbar in place and use a sticky left rail for page-specific
settings navigation. `/settings/tutor` keeps Listing first, Verification second, Subjects
below Verification, and a non-sticky submit-for-review action at the bottom. Subject add
starts as a single button; clicking it opens the add form. Editing a subject happens inline
on the selected subject row. Availability subject assignment should use compact subject
toggle boxes in an internal scroll area instead of small checkboxes that push the page.

## What's real vs. fake

- **Design/layout**: real. `_shared.css` holds the tokens (teal `#0F6E56` / deep teal
  `#0B2B22` on cream, Fraunces headings, Inter body) and every component.
- **Content**: real-looking placeholder data, hard-coded in the HTML.
- **Interactions**: real but client-side. The subject page shows subject-only availability;
  the booking calendar/slot picker enforces adjacency and prices the 1-1 lesson; the
  booking state machine goes from subject booking with no ID to payment due with a
  booking ID to confirmed; tutor booking detail shows
  the student and description; confirmed bookings expose a Zoom link; wallet top-up, lesson payment, and
  payout move a real `localStorage` number; filters filter; chat appends bubbles; forms
  toast instead of submitting.
- **Login/role**: a `localStorage` flag, not real auth — no password is checked and the
  role switch just picks which dashboard / chat side you see. But the flag does gate the
  app pages (logged out → bounced to `login.html`), and logout clears it.
- **Dynamic routes**: still flat — one `booking-detail.html`, one `tutor-detail.html`,
  etc. State comes from `?s=` / `?as=` / `?amt=` / `?next=` query params.
- **Backend, real payments, validation, notifications, persistence** (beyond the wallet
  number): none.

## Taking this to real pages

The source of truth for real product scope is now **`USER_STORIES.md`**. It is written as
YAML inside Markdown and covers the real app epics: auth, profiles/settings, discovery,
subject detail pages, booking, wallet/payments/payouts, lesson delivery, messaging,
reviews, admin trust/safety, dashboards, navigation, and data integrity.

The database sketch for that real scope is **`tutormatcher.dbml`**. It can be pasted into
dbdiagram.io and is linked from the technical foundation stories. It covers users, tutor applications, documents, tutor subjects,
subject-specific availability, 1-1 bookings, wallet transactions, payouts, messages,
reviews, notifications, admin reviews, and audit logs.

Per page, "making it real" means: swap hard-coded data for API calls; give dynamic routes
real `:id` values; replace `_app.js` fake handlers with real auth, booking, wallet ledger,
payout, notification, and chat services; integrate a real payment provider for top-ups;
and enforce role/access checks server-side as well as client-side. Do it one page at a
time, using `USER_STORIES.md` as the acceptance checklist.
