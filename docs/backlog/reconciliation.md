# Backlog Reconciliation

The product backlog in this directory was written from the Product Backlog v1.2 export
and the user-journey SVG. The product has since been settled in a clickable prototype,
now preserved under [`docs/sources/`](../sources/) and described in
[`docs/user-journeys.md`](../user-journeys.md).

This page is the delta between the two. It changes no planning record: story files keep
their IDs, sprint commitments, points, and assignees, and their `sources:` entries still
point at the export they were derived from. Use this page to decide what to reword,
retire, or add — the decision itself belongs to the team, not to this document.

Legend:

| Mark | Meaning                                                                      |
| ---- | ---------------------------------------------------------------------------- |
| ✅   | Matches the product as documented; no change needed                          |
| ✏️   | Right intent, wrong detail — the wording describes behaviour we do not build |
| ⛔   | Contradicts the product — the feature does not exist and is not planned      |
| ➕   | Product behaviour with no story covering it                                  |

---

## 1 · Existing stories

| Story   | Status | What differs from the product                                                                                                                                                                                                                     |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-1  | ⛔     | "Sign up as either a Student or a Tutor … select a role" — there is **no role choice at sign-up**. Every account is created as a student; tutor is an approved application afterwards. Reword to "Create an account".                             |
| AUTH-2  | ✅     |                                                                                                                                                                                                                                                   |
| AUTH-3  | ✅     |                                                                                                                                                                                                                                                   |
| AUTH-4  | ✏️     | The applicant is a **logged-in student**, not yet a Tutor. Submission requires a government ID, a teaching certification, **and** a bio, and the tutor capability is granted only on admin approval.                                              |
| AUTH-5  | ✅     | The sign-up form does carry a Terms and Privacy agreement checkbox.                                                                                                                                                                               |
| AUTH-6  | ✏️     | Framed as a Tutor consenting "during sign-up". Identity documents and payout data are supplied at **application** time, so the consent point is `/(auth)/enroll-tutor`, not sign-up.                                                              |
| BOOK-1  | ✏️     | "Trial lesson … before committing to a package" — there are no packages and no separate trial flow. Every booking is one subject, one continuous block, paid from the wallet. Reword to booking a lesson from a subject's published availability. |
| BOOK-2  | ⛔     | Recurring lessons. The product states "one booking = one continuous block — no weekly plans".                                                                                                                                                     |
| BOOK-3  | ✏️     | Cancel within policy is real, with an eligible refund to the wallet. **Reschedule has no flow in the prototype** — decide whether it is in scope before building.                                                                                 |
| BOOK-4  | ✏️     | Same content as BOOK-3 with the Tutor as actor, and the same reschedule question. The two are duplicates by title; merge or differentiate.                                                                                                        |
| BOOK-5  | ⛔     | Invite a classmate. Bookings are strictly 1-1: "no add-friend or group invite flow".                                                                                                                                                              |
| BOOK-6  | ⛔     | Accept a lesson invitation — same reason as BOOK-5.                                                                                                                                                                                               |
| CLASS-1 | ✅     | Confirmed bookings expose a meeting link to both the student and the tutor.                                                                                                                                                                       |
| CLASS-2 | ✅     | Completion drives settlement and unlocks reviewing.                                                                                                                                                                                               |
| DISC-1  | ✏️     | The real filter set is keyword, subject, maximum price, minimum rating, and format, plus sorting. There is no availability filter and no language filter.                                                                                         |
| DISC-2  | ✅     | "Recommended" is the default sort.                                                                                                                                                                                                                |
| DISC-3  | ✏️     | Correct for `/tutors/:id`, but the tutor page is **not** where booking starts. It needs the subject page as a sibling story — see ➕ DISC-new.                                                                                                    |
| MSG-1   | ✅     |                                                                                                                                                                                                                                                   |
| MSG-2   | ✏️     | Preferences are per event group (booking updates, lesson reminders, new messages, wallet and payments, product news) **and per channel** (email, push).                                                                                           |
| PAY-1   | ⛔/✏️  | PromptPay QR is right; "lesson credits/packages … so recurring bookings don't pay each time" is wrong. Money is held in baht as wallet balance and every booking is paid individually. Reword to "Top up wallet balance".                         |
| PAY-2   | ✏️     | Earnings live in `/wallet`, not a separate earnings page, and **payouts are not tutor-only** — any user with available balance can withdraw.                                                                                                      |
| PAY-3   | ✅     | Refunds return to the wallet; disputes go to an admin.                                                                                                                                                                                            |
| PAY-4   | ⛔     | "Update my payment method" — no stored payment method exists. Top-up is a PromptPay QR each time. The real need is a **payout account**, which belongs with PAY-2 or a new story.                                                                 |
| PROF-1  | ⛔     | A learner profile of subjects of interest, level, and goals does not exist. Student-side settings are account, notifications, and wallet only.                                                                                                    |
| PROF-2  | ✏️     | Correct, but incomplete: listing and document changes are **submitted for admin review** and go live only after approval.                                                                                                                         |
| PROF-3  | ✏️     | "Weekly availability" — availability is set **per date** as 30-minute slots, with one or more of the tutor's subjects assigned to each open slot. There is no weekly recurrence.                                                                  |
| PROF-4  | ✅     |                                                                                                                                                                                                                                                   |
| PROF-5  | ✅     | Classes this week, earnings this month, paid bookings, and rating.                                                                                                                                                                                |
| REV-1   | ✏️     | Right, with two rules to state: a review can be written **only from the reviewer's own completed booking**, and it is scoped to the tutor **and the subject**.                                                                                    |
| REV-2   | ✅     |                                                                                                                                                                                                                                                   |
| REV-3   | ✅     |                                                                                                                                                                                                                                                   |
| REV-4   | ✅     |                                                                                                                                                                                                                                                   |
| SAFE-1  | ✅     |                                                                                                                                                                                                                                                   |
| SAFE-2  | ✅     | Same queue as AUTH-4's outcome; keep the overlap deliberate.                                                                                                                                                                                      |

---

## 2 · Product behaviour with no story

Grouped by the epic they would join. The right-hand column is the matching acceptance
criteria in
[`docs/sources/tutormatcher-prototype-user-stories.md`](../sources/tutormatcher-prototype-user-stories.md).

| Proposed story                                                                                                                        | Epic | Prototype ref  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------- |
| ➕ Route and role guards — logged-out users are returned to their target after login; non-tutors are routed to the application        | AUTH | US1-5          |
| ➕ Tutor application lifecycle — pending state, cancel and re-submit, redirect once approved                                          | AUTH | US1-4          |
| ➕ Manage subjects as separate offerings, each with its own name, description, rate, and format                                       | PROF | US2-5          |
| ➕ Assign subjects to availability slots with compact toggles in a scrolling area                                                     | PROF | US2-7          |
| ➕ Wallet and payout account settings, available to any user                                                                          | PROF | US2-6          |
| ➕ **DISC-new** — subject detail page `/tutors/:id/:subjectId` with subject-only description, rate, format, availability, and reviews | DISC | US3-4          |
| ➕ Subject availability shows all 48 half-hour slots as Available / Not available                                                     | DISC | US3-5, US3-6   |
| ➕ Subject-locked booking flow — subject and rate carried in, no booking record until a time is chosen                                | BOOK | US4-1          |
| ➕ Continuous 30-minute block selection with adjacency enforcement and derived duration and price                                     | BOOK | US4-2, US4-3   |
| ➕ Pay from wallet on `/bookings/:id`; insufficient balance routes to top up the shortfall and returns                                | BOOK | US4-4          |
| ➕ Paid bookings auto-confirm from published availability, with the slot blocked before payment if taken                              | BOOK | US4-5          |
| ➕ Tutor booking view showing the student, the lesson description, format, payout, and meeting link                                   | BOOK | US4-6          |
| ➕ `/bookings` tabs — All, Upcoming, Payment due, Past                                                                                | BOOK | US4-7          |
| ➕ One wallet balance for top-ups, payments, earnings, refunds, and payouts                                                           | PAY  | US5-1          |
| ➕ Completed-lesson earnings clear into available balance and show as pending until then                                              | PAY  | US5-4          |
| ➕ Payout request from available balance for **any** user                                                                             | PAY  | US5-5          |
| ➕ `/wallet` as the single ledger with type filters                                                                                   | PAY  | US5-6          |
| ➕ `/wallet/transactions/:id` read-only detail that redirects unpaid lesson payments to the booking page                              | PAY  | US5-7          |
| ➕ Admin review of tutor listing and document changes before they go live                                                             | SAFE | US2-4, US9-2   |
| ➕ Admin handling of payment disputes and refunds against the wallet ledger                                                           | SAFE | US9-4          |
| ➕ Student dashboard focused on upcoming lessons, wallet balance, and progress                                                        | new  | US10-1         |
| ➕ Tutor dashboard ordered by operational priority with internally scrolling sections                                                 | new  | US10-2, US10-3 |
| ➕ Consistent top navigation with page-specific left rails                                                                            | new  | US10-4, US10-5 |

Stories US10-x have no epic in `backlog.yaml`. They need either a new epic — an
information-architecture or platform epic — or distribution into the existing ones.

---

## 3 · Route drift

`backlog.yaml`'s `journey_coverage` maps routes taken from the journey SVG. Six of those
routes no longer match the product route model in
[`docs/user-journeys.md`](../user-journeys.md#route-model), and the frontend route scaffold in
`apps/frontend/app/` follows the old names.

| In `journey_coverage` and the frontend scaffold | Product route                                 |
| ----------------------------------------------- | --------------------------------------------- |
| `/booking`                                      | `/bookings/s/:subjectId` then `/bookings/:id` |
| `/payments`                                     | `/wallet`                                     |
| `/payments/:id`                                 | `/wallet/transactions/:id`                    |
| `/topup`                                        | `/wallet/topup`                               |
| `/settings`                                     | `/settings/account`                           |
| `/settings/notification`                        | `/settings/notifications`                     |

Routes in the product that `journey_coverage` does not list at all:
`/tutors/:id/:subjectId`, `/settings/wallet`, `/reviews/:tutorId`, and
`/admin/tutor-requests`.

The SVG is immutable evidence and is not being changed. Reconciling means adding the
current routes to `journey_coverage` — which the backlog contract already allows, since
it says reconciliation is additive — and renaming the frontend route folders when those
slices are built.

---

## How to close this out

1. Decide, per ⛔ row, whether to cancel the story (`lifecycle: cancelled`) or to
   rewrite it. Cancelled story files stay in place by the backlog contract.
2. Reword the ✏️ rows in their existing YAML files, keeping the ID and slug stable.
3. Add the ➕ rows as new story files, citing
   `../../sources/tutormatcher-prototype-user-stories.md` with the `US*-*` locator.
4. Extend `journey_coverage` with the current routes.
5. Run `npm run backlog:build`, then `npm run backlog:check` and `npm run format:check`.
6. Sprint 1 currently commits AUTH-1, BOOK-2, BOOK-3, BOOK-4, and PROF-1, all of which
   appear above. Re-scoping the sprint is a product-owner decision — this page does not
   make it.
