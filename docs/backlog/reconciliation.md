# Backlog Reconciliation

The product backlog in this directory was written from the Product Backlog v1.2 export
and the user-journey SVG. The product has since been settled in a clickable prototype,
now preserved under [`docs/sources/`](../sources/) and described in
[`docs/user-journeys.md`](../user-journeys.md).

This page is the delta between the two. It changes no planning record: story files keep
their IDs, sprint commitments, points, and assignees, and their `sources:` entries still
point at the export they were derived from.

**Status: closed.** Issue #63 applied this reconciliation to the YAML planning records —
every row below is resolved, and its resolution is recorded in the last column and in the
story file itself. Three items stay open on purpose, because they are product-owner
decisions rather than documentation facts:

- Whether to build lesson **reschedule** at all (BOOK-3 / BOOK-4).
- Whether to **merge** BOOK-3 and BOOK-4, now that their wording no longer differs.
- What replaces **PROF-1** as DISC-2's personalization input, now that PROF-1 is cancelled.

Legend:

| Mark | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| ✅   | Matched the product already; no change needed                                 |
| 🟢   | Closed by this reconciliation pass                                            |
| 🟡   | Wording closed by this pass; a product-owner decision inside it is still open |

---

## 1 · Existing stories

| Story   | Status | What differed from the product                                                                                                                                                           | Resolution                                                                                                                                                                                                                            |
| ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-1  | 🟢     | "Sign up as either a Student or a Tutor … select a role" — there is no role choice at sign-up. Every account is created as a student; tutor is an approved application afterwards.       | Rewritten in place (kept, not cancelled — 9 stories depend on this ID, per issue #63). Retitled "Create an account".                                                                                                                  |
| AUTH-2  | ✅     | —                                                                                                                                                                                        | No change needed.                                                                                                                                                                                                                     |
| AUTH-3  | ✅     | —                                                                                                                                                                                        | No change needed.                                                                                                                                                                                                                     |
| AUTH-4  | 🟢     | The applicant is a logged-in student, not yet a Tutor. Submission requires a government ID, a teaching certification, and a bio; the Tutor capability is granted only on admin approval. | Reworded in place; `role` changed to "Student", title/description/acceptance criteria updated.                                                                                                                                        |
| AUTH-5  | ✅     | The sign-up form does carry a Terms and Privacy agreement checkbox.                                                                                                                      | No change needed.                                                                                                                                                                                                                     |
| AUTH-6  | 🟢     | Framed as a Tutor consenting "during sign-up". Identity documents and payout data are supplied at application time, so the consent point is `/(auth)/enroll-tutor`, not sign-up.         | Reworded in place; dependency moved from AUTH-1 to AUTH-4; journey moved to `(auth)/enroll-tutor`.                                                                                                                                    |
| BOOK-1  | 🟢     | "Trial lesson … before committing to a package" — there are no packages and no separate trial flow. Every booking is one subject, one continuous block, paid from the wallet.            | Reworded in place; retitled away from "trial lesson".                                                                                                                                                                                 |
| BOOK-2  | 🟢     | Recurring lessons. The product states one booking is one continuous block, with no weekly plans.                                                                                         | Cancelled (`lifecycle: cancelled`); removed from `sprint-1.story_ids` and stripped of sprint execution fields. File stays in place per the backlog contract.                                                                          |
| BOOK-3  | 🟡     | Cancel within policy is real, with an eligible refund to the wallet. Reschedule has no flow in the prototype.                                                                            | Reworded to drop reschedule and match the real 12-hour window and wallet refund. **Open:** whether to build reschedule at all, and whether to merge with BOOK-4.                                                                      |
| BOOK-4  | 🟡     | Same content as BOOK-3 with the Tutor as actor, and the same reschedule question; a duplicate by title and acceptance criteria.                                                          | Reworded the same way as BOOK-3. **Open:** the same merge-or-differentiate call as BOOK-3.                                                                                                                                            |
| BOOK-5  | 🟢     | Invite a classmate. Bookings are strictly 1-1, with no add-friend or group invite flow.                                                                                                  | Cancelled (`lifecycle: cancelled`); was not in sprint 1.                                                                                                                                                                              |
| BOOK-6  | 🟢     | Accept a lesson invitation — same reason as BOOK-5.                                                                                                                                      | Cancelled (`lifecycle: cancelled`); was not in sprint 1.                                                                                                                                                                              |
| CLASS-1 | ✅     | Confirmed bookings expose a meeting link to both the student and the tutor.                                                                                                              | No change needed.                                                                                                                                                                                                                     |
| CLASS-2 | ✅     | Completion drives settlement and unlocks reviewing.                                                                                                                                      | No change needed.                                                                                                                                                                                                                     |
| DISC-1  | 🟢     | The real filter set is keyword, subject, maximum price, minimum rating, and format, plus sorting. There is no availability filter and no language filter.                                | Reworded in place.                                                                                                                                                                                                                    |
| DISC-2  | ✅     | "Recommended" is the default sort.                                                                                                                                                       | No change needed. **Open:** DISC-2 still depends on the now-cancelled PROF-1 for personalization input; a replacement is a product decision (see PROF-1).                                                                             |
| DISC-3  | ✅     | Correct for `/tutors/:id`, but the tutor page is not where booking starts — needs the subject page as a sibling story.                                                                   | No wording change needed; the gap is closed by the new DISC-4 story.                                                                                                                                                                  |
| MSG-1   | ✅     | —                                                                                                                                                                                        | No change needed.                                                                                                                                                                                                                     |
| MSG-2   | 🟢     | Preferences are per event group (booking updates, lesson reminders, new messages, wallet and payments, product news) and per channel (email, push).                                      | Reworded in place.                                                                                                                                                                                                                    |
| PAY-1   | 🟢     | PromptPay QR is right; "lesson credits/packages" is wrong. Money is a baht wallet balance and every booking is paid individually.                                                        | Reworded and retitled "Top up wallet balance"; journey moved to `/wallet/topup`.                                                                                                                                                      |
| PAY-2   | 🟢     | Earnings live in `/wallet`, not a separate earnings page; payouts are not tutor-only.                                                                                                    | Reworded in place first, then cancelled: once reworded, it fully overlapped the new PAY-5 (wallet view), PAY-6 (earnings clearing), and PAY-7 (generalized payout) — see the "found while consolidating" note below.                  |
| PAY-3   | ✅     | Refunds return to the wallet; disputes go to an admin.                                                                                                                                   | No change needed.                                                                                                                                                                                                                     |
| PAY-4   | 🟢     | "Update my payment method" — no stored payment method exists; top-up is a PromptPay QR each time. The real need is a payout account.                                                     | Cancelled (`lifecycle: cancelled`); the payout-account need is covered by the new PROF-7 story.                                                                                                                                       |
| PROF-1  | 🟢     | A learner profile of subjects of interest, level, and goals does not exist. Student-side settings are account, notifications, and wallet only.                                           | Cancelled (`lifecycle: cancelled`); removed from `sprint-1.story_ids` and stripped of sprint execution fields. **Open:** DISC-2's dependency on it.                                                                                   |
| PROF-2  | 🟢     | Correct, but incomplete: listing and document changes are submitted for admin review and go live only after approval.                                                                    | Reworded in place to add the submit-for-review / admin-approval step. Dependency corrected from AUTH-1 to AUTH-4: `/settings/tutor` is Role: tutor, and AUTH-1 no longer implies the Tutor capability once reworded (see AUTH-1 row). |
| PROF-3  | 🟢     | "Weekly availability" — availability is set per date as 30-minute slots, with subjects assigned per slot. There is no weekly recurrence.                                                 | Retitled and reworded to per-date slots; overlap check scoped to the same date. Dropped the redundant direct AUTH-1 dependency; PROF-2 already carries AUTH-4 transitively.                                                           |
| PROF-4  | ✅     | —                                                                                                                                                                                        | No change needed.                                                                                                                                                                                                                     |
| PROF-5  | ✅     | Classes this week, earnings this month, paid bookings, and rating.                                                                                                                       | No change needed.                                                                                                                                                                                                                     |
| REV-1   | 🟢     | A review can be written only from the reviewer's own completed booking, and it is scoped to the tutor and the subject.                                                                   | Reworded in place.                                                                                                                                                                                                                    |
| REV-2   | ✅     | —                                                                                                                                                                                        | No change needed.                                                                                                                                                                                                                     |
| REV-3   | ✅     | —                                                                                                                                                                                        | No change needed.                                                                                                                                                                                                                     |
| REV-4   | ✅     | —                                                                                                                                                                                        | No change needed.                                                                                                                                                                                                                     |
| SAFE-1  | ✅     | —                                                                                                                                                                                        | No change needed.                                                                                                                                                                                                                     |
| SAFE-2  | ✅     | Same queue as AUTH-4's outcome; the overlap is deliberate.                                                                                                                               | No change needed.                                                                                                                                                                                                                     |

---

## 2 · Product behaviour with no story — closed, added as new stories

Every row below now has a story file, added with `lifecycle: backlog` and citing
[`docs/sources/tutormatcher-prototype-user-stories.md`](../sources/tutormatcher-prototype-user-stories.md)
with the matching `US*-*` locator, per issue #63. The first pass filed one story per
reconciliation row; several rows were the same page or the same atomic transaction split
in two, so this pass merged those into one story each — the "Added as" column is the
final, post-merge ID.

| Proposed story                                                                              | Epic | Prototype ref  | Added as | Merged with                         |
| ------------------------------------------------------------------------------------------- | ---- | -------------- | -------- | ----------------------------------- |
| Route and role guards                                                                       | AUTH | US1-5          | AUTH-7   | —                                   |
| Tutor application lifecycle                                                                 | AUTH | US1-4          | AUTH-8   | —                                   |
| Manage subjects as separate offerings                                                       | PROF | US2-5          | PROF-6   | Assign subjects to slots (below)    |
| Assign subjects to availability slots with compact toggles                                  | PROF | US2-7          | PROF-6   | Manage subjects (above)             |
| Wallet and payout account settings, available to any user                                   | PROF | US2-6          | PROF-7   | —                                   |
| Subject detail page `/tutors/:id/:subjectId`                                                | DISC | US3-4          | DISC-4   | 48-slot availability (below)        |
| Subject availability: all 48 half-hour slots as Available / Not available, plus book button | DISC | US3-5, US3-6   | DISC-4   | Subject detail page (above)         |
| Subject-locked booking flow                                                                 | BOOK | US4-1          | BOOK-7   | Continuous block selection (below)  |
| Continuous block selection with adjacency enforcement                                       | BOOK | US4-2, US4-3   | BOOK-7   | Subject-locked booking flow (above) |
| Pay from wallet on `/bookings/:id`, with shortfall top-up                                   | BOOK | US4-4          | BOOK-8   | Auto-confirm (below)                |
| Auto-confirm paid bookings from published availability                                      | BOOK | US4-5          | BOOK-8   | Pay from wallet (above)             |
| Tutor booking detail view                                                                   | BOOK | US4-6          | BOOK-9   | `/bookings` status tabs (below)     |
| `/bookings` status tabs — All, Upcoming, Payment due, Past                                  | BOOK | US4-7          | BOOK-9   | Tutor booking detail (above)        |
| One wallet balance for top-ups, payments, earnings, refunds, and payouts                    | PAY  | US5-1          | PAY-5    | Ledger + transaction detail (below) |
| Completed-lesson earnings clear into available balance                                      | PAY  | US5-4          | PAY-6    | —                                   |
| Payout request from available balance for any user                                          | PAY  | US5-5          | PAY-7    | —                                   |
| `/wallet` as the single ledger with type filters                                            | PAY  | US5-6          | PAY-5    | One wallet balance (above)          |
| `/wallet/transactions/:id` read-only detail                                                 | PAY  | US5-7          | PAY-5    | One wallet balance (above)          |
| Admin review of tutor listing and document changes before they go live                      | SAFE | US2-4, US9-2   | SAFE-3   | —                                   |
| Admin handling of payment disputes and refunds                                              | SAFE | US9-4          | SAFE-4   | —                                   |
| Student dashboard focused on upcoming lessons, wallet balance, and progress                 | IA   | US10-1         | IA-1     | —                                   |
| Tutor dashboard ordered by operational priority with internally scrolling sections          | IA   | US10-2, US10-3 | IA-2     | —                                   |
| Consistent top navigation with page-specific left rails                                     | IA   | US10-4, US10-5 | IA-3     | —                                   |

23 candidate rows collapsed into 16 story files. The merge rule: same page or the same
atomic transaction, ship together, one story. Kept separate: distinct pages or queues
(payout vs. earnings clearing; listing review vs. dispute handling; each dashboard and the
nav shell it renders inside).

Stories US10-x had no epic in `backlog.yaml`. This pass added `EPIC-10` (acronym `IA`,
"Information Architecture & Navigation") rather than distributing them into existing
epics, and filed IA-1/IA-2/IA-3 against it. IA-1 and IA-2 depend on IA-3 (the nav shell),
not the other way around, since both dashboards render inside it.

---

## 3 · Route drift — closed, coverage extended

`backlog.yaml`'s `journey_coverage` mapped routes taken from the journey SVG. The SVG is
immutable evidence and was not changed; instead, this pass added entries for the current
product routes alongside the old ones (reconciliation is additive), and reclassified the
handful of entries that only pointed at now-cancelled stories (BOOK-5, BOOK-6, PAY-4,
PROF-1) as `non-story`.

| Historical `journey_coverage` route (kept) | Current product route                         | Coverage added for     |
| ------------------------------------------ | --------------------------------------------- | ---------------------- |
| `/booking`                                 | `/bookings/s/:subjectId` then `/bookings/:id` | BOOK-7, BOOK-8, BOOK-9 |
| `/payments`                                | `/wallet`                                     | PAY-5, PAY-6, PAY-7    |
| `/payments/:id`                            | `/wallet/transactions/:id`                    | PAY-5                  |
| `/topup`                                   | `/wallet/topup`                               | PAY-1                  |
| `/settings`                                | `/settings/account`                           | PROF-4                 |

`/settings/notification` (singular) was also a historical SVG route mapping to MSG-2
at `/settings/notifications` (plural). PR review pointed out that keeping both was
just a duplicate entry pointing at the same story once pluralized, so it was removed
from `journey_coverage` rather than kept as an identical duplicate.

Routes that had no `journey_coverage` entry at all now have one:

| Route                    | Coverage added for     |
| ------------------------ | ---------------------- |
| `/tutors/:id/:subjectId` | DISC-4, REV-1          |
| `/settings/wallet`       | PROF-7                 |
| `/reviews/:tutorId`      | REV-1, REV-2, REV-3    |
| `/admin/tutor-requests`  | SAFE-2, SAFE-3, SAFE-4 |

Renaming the frontend route folders under `apps/frontend/app/` to match stays out of scope
here, as originally noted — that happens when each slice is built.

---

## Sprint 1 capacity — closed

`sprint-1.yaml` `capacity_hours` was `272`, matching the estimate sum of its 19 stories.
Cancelling BOOK-2 (-20h) and PROF-1 (-8h) and removing both from `story_ids` drops that sum
to `244`; `capacity_hours` was updated to match, and pair workloads were otherwise left
alone. AUTH-1 was rewritten, not cancelled, so its 20h and pair are unchanged. BOOK-3 and
BOOK-4 stay separate stories at their existing estimates, pending the open merge decision
above.

## Found while consolidating

A later pass over this same reconciliation caught two problems introduced by the first
pass, both fixed in place rather than left as new findings for someone else to close:

- **PAY-2 duplicated PAY-5/PAY-6/PAY-7.** Reworded correctly (✏️) in the first pass, but
  once "earnings live in `/wallet`" and "payouts are not tutor-only" were applied, its
  remaining behaviour — view cleared earnings, request a payout, block if over balance —
  was fully covered by the three new stories PAY-5, PAY-6, and PAY-7 (also added in the
  first pass). Cancelled PAY-2 rather than carry two specifications of the same payout
  mechanism; it had no dependents and was not in Sprint 1.
- **PROF-2 and PROF-3 depended on AUTH-1, not AUTH-4.** That was correct under the old
  AUTH-1 wording ("sign up as a Tutor"), but AUTH-1 was reworded in this same pass to
  create only a Student account — `/settings/tutor` is `Role: tutor`, so the real
  prerequisite is an approved AUTH-4 application. Fixed both dependencies; see their
  files' comments.
- 23 new stories from section 2 were originally filed one per acceptance-criteria
  cluster from the prototype user-stories source, rather than by shippable increment.
  Consolidated to 16 — see section 2's "Merged with" column for the mapping — and
  corrected a few dependencies that only became wrong after stories moved or merged
  (`BOOK-8`/`PROF-6` gained missing prerequisites, `IA-1`/`IA-2` now depend on `IA-3`
  instead of the reverse).
- **Sprint 1's `order` values did not respect `dependencies` at all**, predating every
  pass above. `AUTH-1` (needed by AUTH-2/3/4/5, and transitively by PROF-2/3/4, DISC-1/2/3,
  BOOK-1/3/4) sat at `order: 15` out of 17 — nine higher-priority stories were scheduled to
  start before the account system they depend on existed. Likewise `DISC-1` (order 17)
  blocked `DISC-2`/`DISC-3` (orders 9–10), and `BOOK-1` (order 18) blocked `BOOK-3`/`BOOK-4`
  (orders 12–13). Recomputed `order` for all 17 Sprint 1 stories as a topological sort of
  their dependency graph (1 = `AUTH-1` first; 17 = `BOOK-4` last); every dependency now has
  a strictly lower `order` than every story that depends on it. `estimate_hours`,
  `assignees`, and `story_points` are unchanged — this only reordered the sequence.

## What this page does not decide

- **Reschedule scope** (BOOK-3, BOOK-4): the prototype has no reschedule flow; whether to
  build one is a product-owner call.
- **BOOK-3 / BOOK-4 merge**: both are reworded to the same facts and still duplicate each
  other; merging or differentiating them is a product-owner call.
- **DISC-2's personalization input**: it depended on the now-cancelled PROF-1; a
  replacement (or removing the "recommended" sort's personalization basis) is a
  product-owner call.

See issue #63 for the full worklog this page's rows map onto.
