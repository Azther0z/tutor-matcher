# Database Schema — Tutor Matcher

This page is the canonical data model for the product. It has three inputs and states
plainly which is authoritative for what:

| Input                                                                            | Authoritative for                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`user-journeys.md`](user-journeys.md) and the prototype under `sources/`        | What the product must store — the requirement model  |
| `apps/backend/prisma/schema.prisma`                                              | What the database actually contains today            |
| [`sources/tutor-matcher-final-report.md`](sources/tutor-matcher-final-report.md) | The earlier database-course design — historical only |

The Final Report's schema (`Person`, `Class`, `AvailableTime`, `Payment` with transfer
proof, `Post`) described a different product and is **not** the product schema. It is
kept as immutable course evidence; see "Historical: the Final Report" below. Do not use
it to build application features.

Terms below follow [`CONTEXT.md`](../CONTEXT.md).

---

## Domain Shape

```
User (every account; student by default)
 ├─ tutorId  ──> Tutor ──< Subject ──< AvailabilitySubject >── Availability (30-min slot)
 │                 │          └──< SubjectLearningArea >── LearningArea (fixed list)
 │                 └─ currentProfileVersionId → TutorProfileVersion │
 ├──< TutorProfileVersion ──< TutorProfileVersionCertification       │
 ├─ isAdmin                                                        │
 └──< Student ──< StudentLearningArea >── LearningArea             │
 ├─ Wallet balance ──< WalletTransaction                │
 ├──< Booking >── Subject                                          │
 │      └── occupies one continuous run of ────────────────────────┘
 │      ├──< Review >── Subject
 │      └──< WalletTransaction (lesson payment / refund / future earning)
 ├──< Message (to another User)
 └──< Report (as reporter · as reported · as handling admin)
 └──< PasswordResetToken (hashed, expiring, single-use)
```

Reading the shape:

- A **User** is one account. `isAdmin` layers an administrative capability onto it;
  is no separate student or tutor account record.
- A **Subject** is owned by a tutor and is what a student books. It is tagged with one to
  three **LearningAreas** through **SubjectLearningArea**; students pick from the same list
  at onboarding, so search and recommendations can match the two.
- Recommended discovery uses the Student's selected learning areas, Subject reviews and
  open unbooked availability assigned through **AvailabilitySubject**. The database has no
  Subject goal tags, so Student goals do not currently contribute to recommendation scores.
- An **Availability** slot belongs to the tutor and is offered for one or more of that
  tutor's subjects through **AvailabilitySubject**.
- A **Booking** is one student, one subject, and one continuous run of slots.
- Available money lives on the user's balance and moves through append-only **WalletTransaction** rows. Paid lesson money stays with the platform until refunded or settled.
- A **PasswordResetToken** belongs to one user and stores only a SHA-256 hash of the
  emailed token; it expires after 30 minutes and is marked used after a successful reset.

---

## Implemented Tables

Source of truth for this section is `apps/backend/prisma/schema.prisma`. Column names
are the database names; the Prisma field name is given where it differs.

### users

| Column     | Type          | Constraints                                            | Notes                              |
| ---------- | ------------- | ------------------------------------------------------ | ---------------------------------- |
| user_id    | SERIAL        | PK                                                     | Prisma `id`                        |
| first_name | TEXT          | NOT NULL                                               |                                    |
| last_name  | TEXT          | NOT NULL                                               |                                    |
| email      | TEXT          | UNIQUE, NOT NULL                                       | Login identity                     |
| password   | TEXT          | NOT NULL                                               | Stores the password hash           |
| bio        | TEXT          | NULL                                                   |                                    |
| created_at | TIMESTAMP     | NOT NULL, DEFAULT now()                                |                                    |
| balance    | NUMERIC(12,2) | NOT NULL, DEFAULT 0                                    | The user's single wallet balance   |
| is_admin   | BOOLEAN       | NOT NULL, DEFAULT false                                |                                    |
| tutor_id   | INT           | UNIQUE, NULL, FK → tutors.tutor_id, ON DELETE SET NULL | Optional link to the tutor profile |

### password_reset_tokens

| Column                  | Type      | Constraints                                             | Notes                                          |
| ----------------------- | --------- | ------------------------------------------------------- | ---------------------------------------------- |
| password_reset_token_id | UUID      | PK, DEFAULT UUID                                        | Prisma `id`                                    |
| token_hash              | TEXT      | UNIQUE, NOT NULL                                        | SHA-256 hash; the raw token is never persisted |
| expires_at              | TIMESTAMP | NOT NULL                                                | 30 minutes after issuance                      |
| used_at                 | TIMESTAMP | NULL                                                    | Set atomically when the password is changed    |
| created_at              | TIMESTAMP | NOT NULL, DEFAULT now()                                 | Issuance time                                  |
| user_id                 | UUID      | UNIQUE, NOT NULL, FK → users.user_id, ON DELETE CASCADE | One current token per user                     |

Indexes: unique `token_hash`, unique `user_id`, and `expires_at`.

### tutors

| Column                     | Type        | Constraints                                   | Notes                                     |
| -------------------------- | ----------- | --------------------------------------------- | ----------------------------------------- |
| tutor_id                   | UUID        | PK                                            | Stable identity for subjects and bookings |
| current_profile_version_id | UUID        | UNIQUE, NOT NULL, FK → tutor_profile_versions | Current approved content                  |
| enrolled_at                | TIMESTAMP   | NOT NULL, DEFAULT now()                       | Initial approval time                     |
| status                     | TutorStatus | NOT NULL, DEFAULT `UNPUBLISHED`               | Publication only                          |

### tutor_profile_versions

| Column                  | Type                      | Constraints               | Notes                                       |
| ----------------------- | ------------------------- | ------------------------- | ------------------------------------------- |
| profile_version_id      | UUID                      | PK                        | Application or profile revision             |
| user_id                 | UUID                      | NOT NULL, FK → users      | Owner, including students with no Tutor yet |
| avatar_url              | TEXT                      | NULL                      | Proposed photo                              |
| bio                     | TEXT                      | NULL                      | Required on submission                      |
| intro_video_url         | TEXT                      | NULL                      | Required on submission                      |
| identification_card_url | TEXT                      | NULL                      | Private; required on submission             |
| status                  | TutorProfileVersionStatus | NOT NULL, DEFAULT `DRAFT` | Review lifecycle                            |
| created_at              | TIMESTAMP                 | NOT NULL, DEFAULT now()   | Orders drafts and history                   |
| submitted_at            | TIMESTAMP                 | NULL                      | Set on submission                           |
| reviewed_at             | TIMESTAMP                 | NULL                      | Set on admin decision                       |
| reviewed_by_id          | UUID                      | NULL, FK → users          | Reviewing admin                             |
| rejection_reason        | TEXT                      | NULL                      | Required when rejecting                     |

Draft fields may be incomplete. A user may own multiple drafts, each independently
editable and discardable by its ID, including while another version is pending.
Submission requires a bio, identification-card URL, introduction-video URL, and consent.
Certifications are optional; every supplied certification URL must be valid. Submitted versions are
immutable. User-row locks serialize submissions, withdrawal and review; only one
pending version per user is allowed, enforced by a partial unique index in `schema.prisma`. Approval atomically creates a Tutor or updates
its pointer, only to an approved version belonging to that user. Publication remains
independent. Withdrawal only marks the submitted version CANCELLED; it creates no draft.
The owner can explicitly copy a cancelled or rejected submission into a new DRAFT with its own ID
and the exact content and certification URLs. Review metadata is not copied. Other drafts
and the current approved profile remain unchanged. Approved history is retained; content is not copied into `tutors`.

### tutor_profile_version_certifications

| Column             | Type | Constraints                                              | Notes                                                                  |
| ------------------ | ---- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| certification_id   | UUID | PK                                                       |                                                                        |
| profile_version_id | UUID | NOT NULL, FK → tutor_profile_versions, ON DELETE CASCADE | Version-specific certificate                                           |
| file_url           | TEXT | NOT NULL                                                 | Portfolio certificate URL; public only in the current approved version |

The Tutor form no longer collects certifications: each draft save sends an empty list, so new
versions carry none. The table and API remain for earlier data and a later upload story. Draft
saves replace only that draft's complete certificate collection, including explicit removals.
Certificates in the current approved version remain unchanged until review approves a
replacement; historical certificates stay attached to the version that was reviewed.

### subjects

| Column      | Type          | Constraints                                        | Notes                                |
| ----------- | ------------- | -------------------------------------------------- | ------------------------------------ |
| subject_id  | UUID          | PK                                                 |                                      |
| name        | TEXT          | NOT NULL                                           |                                      |
| description | TEXT          | NULL                                               |                                      |
| video_url   | TEXT          | NULL                                               |                                      |
| hourly_rate | NUMERIC(10,2) | NOT NULL                                           | Lesson price is derived from this    |
| format      | SubjectFormat | NOT NULL, DEFAULT `ONLINE`                         | Only `ONLINE` is currently supported |
| tutor_id    | UUID          | NOT NULL, FK → tutors.tutor_id, ON DELETE RESTRICT |                                      |

Index: `tutor_id`.

PROF-6 requires a nonempty name and description on create/update, with limits of 100
and 2000 characters. Description remains nullable in storage for legacy offerings.
The API accepts positive THB rate strings with at most two decimals within the column's
precision. Subject names are not unique. Saves are owner-only and immediate, independent
of Tutor profile review and publication; no subject review or removal lifecycle is added.

DISC-1 tags every subject with one to three learning areas. The name stays free text and
is the offering's title; the areas are only a category for discovery. Create and update
replace the full set and reject an empty list, more than three areas, or an unknown id.
Bookings do not snapshot the areas.

### learning_areas

| Column           | Type | Constraints | Notes                               |
| ---------------- | ---- | ----------- | ----------------------------------- |
| learning_area_id | UUID | PK          |                                     |
| name             | TEXT | UNIQUE      | Fixed list, e.g. Mathematics, Other |

The team curates this list; users cannot add areas. `apps/backend/prisma/seed-prod.ts` upserts
it in every environment, and the mock seed runs it first. Students link to it through
`student_learning_areas` and subjects through `subject_learning_areas`.

### subject_learning_areas

| Column           | Type | Constraints                                                   | Notes |
| ---------------- | ---- | ------------------------------------------------------------- | ----- |
| subject_id       | UUID | PK (with learning_area_id), FK → subjects, ON DELETE CASCADE  |       |
| learning_area_id | UUID | PK (with subject_id), FK → learning_areas, ON DELETE RESTRICT |       |

Index: `learning_area_id`. The one-to-three limit is enforced by the subject API, not the database.

### availabilities

| Column          | Type      | Constraints                                        | Notes                                     |
| --------------- | --------- | -------------------------------------------------- | ----------------------------------------- |
| availability_id | UUID      | PK                                                 |                                           |
| started_at      | TIMESTAMP | NOT NULL                                           | Start of a 30-minute slot                 |
| tutor_id        | UUID      | NOT NULL, FK → tutors.tutor_id, ON DELETE RESTRICT | Explicit slot owner                       |
| is_open         | BOOLEAN   | NOT NULL, DEFAULT true                             | Tutor permits new bookings when true      |
| booking_id      | UUID      | NULL, FK → bookings.booking_id, ON DELETE SET NULL | Set = locked to a booking or payment hold |

PROF-3 adds a unique `(tutor_id, started_at)` constraint and retains the `booking_id` index.
The application enforces Bangkok-local :00/:30 starts, so unique Tutor/start also prevents
overlapping half-hours. One booking may hold multiple slots. Closed slots keep their ID and
subject assignments; booking reads and eligibility require `is_open`, no claim and a future start.
Owner day saves validate subject ownership, immutable held/paid/past slots and a revision of
the loaded state inside a serializable transaction. Conflicts roll back every submitted edit.

### availability_subjects

| Column          | Type | Constraints                                                             |
| --------------- | ---- | ----------------------------------------------------------------------- |
| availability_id | UUID | PK (composite), FK → availabilities.availability_id, ON DELETE RESTRICT |
| subject_id      | UUID | PK (composite), FK → subjects.subject_id, ON DELETE RESTRICT            |

Which of the tutor's subjects that slot is offered for. This join is what makes a
subject page show subject-filtered availability.

### bookings

| Column              | Type          | Constraints                                            | Notes                                                        |
| ------------------- | ------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| booking_id          | UUID          | PK                                                     |                                                              |
| description         | TEXT          | NULL                                                   | The student's "what do you want to learn" note               |
| zoom_meeting_url    | TEXT          | NULL                                                   | Meeting link for the lesson                                  |
| created_at          | TIMESTAMP     | NOT NULL, DEFAULT now()                                |                                                              |
| user_id             | UUID          | NOT NULL, FK → users.user_id, ON DELETE RESTRICT       | The student                                                  |
| subject_id          | UUID          | NOT NULL, FK → subjects.subject_id, ON DELETE RESTRICT | Identifies the tutor through the subject                     |
| status              | BookingStatus | NOT NULL, DEFAULT `PENDING_PAYMENT`                    | `PENDING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `CANCELLED`     |
| started_at          | TIMESTAMP     | NOT NULL                                               | Agreed first-slot start                                      |
| ended_at            | TIMESTAMP     | NOT NULL                                               | Agreed last-slot end                                         |
| total_amount        | NUMERIC(12,2) | NOT NULL                                               | Agreed price                                                 |
| payment_expires_at  | TIMESTAMP     | NULL                                                   | Active payment-hold deadline                                 |
| cancelled_at        | TIMESTAMP     | NULL                                                   | Cancellation time                                            |
| cancellation_reason | TEXT          | NULL                                                   | Cancellation reason                                          |
| is_trial            | BOOLEAN       | NOT NULL, DEFAULT true                                 | Existing booking API field; no trial flow is added by PROF-3 |

Indexes: `user_id`, `subject_id`.

PROF-6 also adds the following nullable subject snapshot columns to `bookings`:

| Column              | Type          | Purpose                                      |
| ------------------- | ------------- | -------------------------------------------- |
| subject_name        | TEXT          | Agreed offering name; marks a saved snapshot |
| subject_description | TEXT          | Agreed description, including legacy NULL    |
| subject_hourly_rate | NUMERIC(10,2) | Agreed hourly rate                           |
| subject_format      | SubjectFormat | Agreed `ONLINE` format                       |

New bookings capture these values at creation. Before a subject changes, its existing
bookings without snapshots capture the previously stored details in the same serializable
transaction. Existing snapshots and booking totals are never rewritten by a subject edit.
Booking responses fall back to the live subject only for legacy bookings until their
first subject edit. Values overwritten before this feature are not reconstructible.

BOOK-4 also adds a nullable column to `bookings` saying who cancelled:

| Column       | Type               | Purpose                                                      |
| ------------ | ------------------ | ------------------------------------------------------------ |
| cancelled_by | BookingCancelledBy | `STUDENT` or `TUTOR`; NULL for payment-hold expiry and older |

### wallet_transactions

Replaces `payments`, `PaymentType` and `PaymentStatus` per the approved
[ledger decision](sources/tutormatcher-wallet-ledger-decision.md) and
[implementation guide](sources/tutormatcher-wallet-ledger-implementation.md).

| Column                | Type                  | Constraints                              | Meaning                                                                                  |
| --------------------- | --------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| wallet_transaction_id | UUID                  | PK                                       | Prisma `id`; top-up request reference                                                    |
| type                  | WalletTransactionType | NOT NULL                                 | Type determines the sign                                                                 |
| amount                | NUMERIC(12,2)         | NOT NULL                                 | Positive magnitude; shared writer rejects negative/fractional-cent values and skips zero |
| balance_after         | NUMERIC(12,2)         | NOT NULL                                 | Available balance immediately after this movement                                        |
| created_at            | TIMESTAMP             | NOT NULL, DEFAULT now()                  | Time money moved                                                                         |
| user_id               | UUID                  | NOT NULL, FK → users, ON DELETE RESTRICT | Exactly one wallet owner                                                                 |
| booking_id            | UUID                  | NULL, FK → bookings, ON DELETE RESTRICT  | Lesson payment, refund or future lesson earning                                          |

Unique: `(booking_id, type)`. Index: `(user_id, created_at)`.
There is no status, direction, completed time or from/to pair. Rows are immutable in
application code and created only on successful money movement. Direct SQL is not
protected by an append-only trigger or positive-amount CHECK; the shared writer is
the enforcement boundary.

All runtime balance changes use the shared writer inside a serializable transaction.
A conditional debit cannot spend more than the available balance. The matching booking
status change commits or rolls back with the balance and row. Creating, expiring or
cancelling an unpaid booking creates no row. Paying uses `Booking.totalAmount`.
Refunds append a new row without changing the lesson payment. BookingStatus is unchanged.
The booking API's legacy `payment.status` is derived presentation compatibility, not
a stored ledger status.

PAY-1 implements simulated TOP_UP plus existing LESSON_PAYMENT/REFUND paths.
LESSON_EARNING is an enum value for separate future work. The wallet
dashboard and calculated pending earnings are not implemented by this change.

PAY-7 writes PAYOUT rows for simulated payouts and adds a nullable column saying where
each payout was sent. The debit and the row commit in one serializable transaction.

| Column            | Type | Constraints                                    | Meaning                                                |
| ----------------- | ---- | ---------------------------------------------- | ------------------------------------------------------ |
| payout_account_id | UUID | NULL, FK → payout_accounts, ON DELETE RESTRICT | The account a PAYOUT was sent to; NULL for other types |

Do not synchronize an existing populated database with an unattended destructive
`db push`. See [safe rollout](change/pay-1-wallet-ledger/design.md).

### payout_accounts

PROF-7 adds each user's saved Thai bank accounts for payouts. Any user can have them, not
only Tutors.

| Column              | Type      | Constraints                              | Meaning                                                  |
| ------------------- | --------- | ---------------------------------------- | -------------------------------------------------------- |
| payout_account_id   | UUID      | PK                                       | Prisma `id`                                              |
| bank_code           | TEXT      | NOT NULL                                 | Code from the backend Thai bank list, e.g. `KBANK`       |
| account_holder_name | TEXT      | NOT NULL                                 | Name on the bank account, 1 to 100 characters            |
| account_number      | TEXT      | NOT NULL                                 | Full number, 10 to 15 digits; API responses only mask it |
| is_default          | BOOLEAN   | NOT NULL, DEFAULT false                  | The account payouts use unless the user picks another    |
| created_at          | TIMESTAMP | NOT NULL, DEFAULT now()                  | Oldest remaining account becomes default after a removal |
| removed_at          | TIMESTAMP | NULL                                     | Set when the user removes it; the row stays for payouts  |
| user_id             | UUID      | NOT NULL, FK → users, ON DELETE RESTRICT | Owner                                                    |

Partial unique index `payout_accounts_one_default_per_user` on `(user_id) WHERE is_default`
keeps one default per user. Index: `(user_id, created_at)`. Removing an account sets
`removed_at` and clears `is_default`, and is never a hard delete, because
`wallet_transactions.payout_account_id` can point at it. The service allows at most 5
active accounts and changes the default in one serializable transaction. Accounts cannot
be edited; the user removes one and adds it again.

### reviews

| Column       | Type      | Constraints                                            | Notes                            |
| ------------ | --------- | ------------------------------------------------------ | -------------------------------- |
| review_id    | SERIAL    | PK                                                     |                                  |
| rating_stars | INT       | NOT NULL, CHECK BETWEEN 1 AND 5                        | `reviews_rating_stars_range`     |
| text         | TEXT      | NULL                                                   |                                  |
| created_at   | TIMESTAMP | NOT NULL, DEFAULT now()                                |                                  |
| user_id      | INT       | NOT NULL, FK → users.user_id, ON DELETE RESTRICT       | The reviewing student            |
| subject_id   | INT       | NOT NULL, FK → subjects.subject_id, ON DELETE RESTRICT | Makes reviews subject-scoped     |
| booking_id   | INT       | NOT NULL, FK → bookings.booking_id, ON DELETE RESTRICT | Reviews originate from a booking |

Indexes: `user_id`, `subject_id`, `booking_id`.

The CHECK constraint lives in
`prisma/migrations/20260831093000_add_review_rating_range_check/migration.sql` because
Prisma cannot express it in the schema.

### messages

| Column       | Type      | Constraints                                      |
| ------------ | --------- | ------------------------------------------------ |
| message_id   | SERIAL    | PK                                               |
| created_at   | TIMESTAMP | NOT NULL, DEFAULT now()                          |
| message      | TEXT      | NOT NULL                                         |
| from_user_id | INT       | NOT NULL, FK → users.user_id, ON DELETE RESTRICT |
| to_user_id   | INT       | NOT NULL, FK → users.user_id, ON DELETE RESTRICT |

Indexes: `from_user_id`, `to_user_id`. A conversation is derived from the user pair.

### reports

| Column           | Type   | Constraints                                      | Notes                   |
| ---------------- | ------ | ------------------------------------------------ | ----------------------- |
| report_id        | SERIAL | PK                                               |                         |
| message          | TEXT   | NOT NULL                                         | What was reported       |
| attachment       | TEXT   | NULL                                             | Evidence file reference |
| reply_message    | TEXT   | NULL                                             | Admin response          |
| admin_user_id    | INT    | NOT NULL, FK → users.user_id, ON DELETE RESTRICT | Handling admin          |
| reporter_user_id | INT    | NOT NULL, FK → users.user_id, ON DELETE RESTRICT |                         |
| reported_user_id | INT    | NOT NULL, FK → users.user_id, ON DELETE RESTRICT |                         |

Indexes: `admin_user_id`, `reporter_user_id`, `reported_user_id`.

### Enums

| Enum                        | Values                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| `TutorStatus`               | `UNPUBLISHED`, `PUBLISHED`                                       |
| `TutorProfileVersionStatus` | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`          |
| `WalletTransactionType`     | `TOP_UP`, `LESSON_PAYMENT`, `LESSON_EARNING`, `REFUND`, `PAYOUT` |
| `BookingCancelledBy`        | `STUDENT`, `TUTOR`                                               |

---

## Integrity Rules The Product Requires

These come from [`user-journeys.md`](user-journeys.md#invariants). Each one has to be
enforced somewhere — a constraint, a transaction, or a service-layer check — and the
"Enforced today" column says where it stands.

| #   | Rule                                                                                    | Enforced today                                                                                         |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | A rating is between 1 and 5                                                             | ✅ CHECK `reviews_rating_stars_range`                                                                  |
| 2   | An availability slot is locked to at most one booking                                   | ✅ one nullable booking FK per slot; atomic serializable claims                                        |
| 3   | A booking has at most one lesson payment                                                | ✅ `wallet_transactions(booking_id, type)` UNIQUE                                                      |
| 4   | A user's subjects, bookings, and payments survive referential deletes                   | ✅ `ON DELETE RESTRICT` across the domain                                                              |
| 5   | A booking occupies a **continuous run** of slots for one subject                        | ✅ booking service validates assigned, consecutive slots on one Bangkok day                            |
| 6   | A booking carries a lifecycle status (payment due → confirmed → completed/cancelled)    | ✅ `BookingStatus`; completion processing remains separate work                                        |
| 7   | Booking price is fixed at creation from the subject rate and the slot count             | ✅ stored total and PROF-6 subject snapshots                                                           |
| 8   | A slot cannot be double-sold — the check happens before payment capture                 | ✅ serializable booking claims and payment confirmation                                                |
| 9   | Exactly one review per booking                                                          | ❌ `reviews.booking_id` is not UNIQUE                                                                  |
| 10  | Each successful movement records one owner, type, positive amount and resulting balance | ✅ shared atomic writer; no status/direction columns                                                   |
| 11  | Available balance excludes pending tutor earnings                                       | ✅ no tutor credit at payment; calculated pending-earnings dashboard and settlement remain future work |
| 12  | A tutor cannot open two overlapping slots                                               | ✅ PROF-3: unique Tutor/start plus half-hour grid validation                                           |

---

## Reconciliation: Requirement vs Implementation

The requirements come from canonical [`user-journeys.md`](user-journeys.md). The prototype's
[`data sketch`](sources/tutormatcher-prototype.dbml) is historical evidence. The gaps
below compare documented journeys with `schema.prisma`; resolved entries are identified. They are
recorded here so the next schema change is deliberate; nothing in this list is a claim
that the current schema is wrong to have shipped.

### Gaps that block a documented journey

| ID  | Gap                                                                                                                                                  | Journey it blocks                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| G1  | Resolved in existing booking code: a Booking has multiple Availability rows and validates a continuous block.                                        | §3 Booking — multi-slot blocks, duration, price |
| G2  | Status storage is implemented by `BookingStatus`; automatic completion remains separate work.                                                        | §3 Booking, `/bookings` tabs, §5 completion     |
| G3  | Resolved in existing booking/PROF-6 code: stored start, end, total and subject snapshots preserve the agreement.                                     | §3 Payment due, §4 ledger amounts               |
| G4  | Storage resolved: WalletTransaction has all five types, one owner and balance_after. Full wallet history UI remains future work.                     | §4 Money                                        |
| G5  | Storage resolved: pending earnings are derived from CONFIRMED bookings, not ledger rows. Calculation UI and settlement are not implemented in PAY-1. | §4 pending earnings                             |
| G6  | Resolved in existing booking code: `zoom_meeting_url` is nullable while awaiting lesson delivery.                                                    | §3 Step 2                                       |
| G7  | Resolved by PROF-3: every availability has a required Tutor owner, an open state and unique Tutor/start.                                             | §7 Availability editor                          |

### Entities the product needs that do not exist yet

| ID  | Missing                                                                                                                              | Journey                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| G10 | Resolved by PROF-7: `payout_accounts` stores each user's bank accounts with one default.                                             | §4 Payouts, `/settings/wallet` |
| G11 | **Notification preference** per user and event type, with email and push flags                                                       | §8 Notifications               |
| G12 | **Review reply** from the tutor, and a moderation status on reviews and messages                                                     | §9 Reviews, §10 Admin          |
| G13 | **Account suspension / ban** state on `users`                                                                                        | §10 Admin                      |
| G14 | **Subject format** (online / in-person) and **subject status** (draft / published / archived)                                        | §2 Search filters, §7 Subjects |
| G16 | `reports` has no type, status, or timestamps, and `admin_user_id` is NOT NULL — a report cannot be filed before an admin picks it up | §10 Admin queues               |
| G18 | **Audit log** for admin decisions on content and money                                                                               | §10 Admin                      |

---

## Indexes

Present today: `subjects(tutor_id)`, `bookings(user_id)`, `bookings(subject_id)`,
`wallet_transactions(user_id, created_at)`, `reviews(user_id)`,
`reviews(subject_id)`, `reviews(booking_id)`,
`tutor_profile_version_certifications(profile_version_id)`,
`tutor_profile_versions(user_id, created_at)`,
`tutor_profile_versions(status, submitted_at)`,
`messages(from_user_id)`, `messages(to_user_id)`, `reports(admin_user_id)`,
`reports(reporter_user_id)`, `reports(reported_user_id)`, plus the unique indexes on
`users(email)`, `users(tutor_id)`, `tutors(current_profile_version_id)`, `password_reset_tokens(token_hash)`,
`password_reset_tokens(user_id)`,
`availabilities(tutor_id, started_at)` (unique), and
`wallet_transactions(booking_id, type)`.
PROF-7 adds `payout_accounts(user_id, created_at)` and the partial unique
`payout_accounts(user_id) WHERE is_default`.

Access patterns from the journeys that are not covered yet:

| Query                                      | Suggested index                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Subject page availability for a date range | Covered for Tutor/date by PROF-3's unique `availabilities(tutor_id, started_at)` |
| Open slots offered for one subject         | `availability_subjects(subject_id)`                                              |
| A user's wallet ledger, newest first       | Covered by `wallet_transactions(user_id, created_at)`                            |
| `/bookings` tabs by status                 | `bookings(user_id, status)` once G2 is closed                                    |
| Search by rating and price                 | aggregate rating on the tutor or subject, plus `subjects(hourly_rate)`           |

---

## Historical: The Final Report

> **Not the product schema.** The database-course Final Report used a different design
> (`Person`, `Class`, `AvailableTime`, transfer-proof `Payment`, `Post`). Read this only
> for design reasoning, never for the product's data model — that's everything above.

Its SQL runs against that old schema, not this one, so it will not run here. The
reasoning still holds up and is worth a skim before writing similar logic today:

- **Booking state changes belong in one transaction.** Its `sp_confirm_booking` and
  `sp_cancel_booking` update status, write the related payment or message row, and
  release time slots together, not as separate calls.
- **Keep an availability flag in sync with a trigger**, not scattered application code —
  its `trg_sync_slot_availability` derives "is this slot free" from whether a booking is
  attached to it.
- **Gate reviews with a database check**, not just a UI check — its
  `trg_validate_review_eligibility` only allows a review when a completed booking exists.
- **Index for the query shape you actually run** — it picks unclustered indexes because
  it expects frequent inserts, and justifies that trade-off explicitly rather than
  indexing by default.
- **A document design can embed for the read path it serves** — its MongoDB sketch embeds
  reviews inside a class document because a class and its reviews are always displayed
  together.

For the full detail — exact procedure bodies, index definitions, execution-plan
comparisons, and the embedded-document schema — read the immutable source directly:
[Final Report](sources/tutor-matcher-final-report.md).

---

## Changing This Schema

1. Change `apps/backend/prisma/schema.prisma`, synchronize disposable databases with
   `prisma db push`, and update the seeds: reference data every environment needs in
   `apps/backend/prisma/seed-prod.ts` (run on every backend start), local fixtures in
   `apps/backend/prisma/seed-mock.ts`.
2. Update the tables above and close the matching gap row in the same change.
3. If the change alters product behaviour rather than only storage, update
   [`user-journeys.md`](user-journeys.md) and [`CONTEXT.md`](../CONTEXT.md) too.
4. Record constraints Prisma cannot express as an explicit schema gap until the team
   adopts a persistent-database migration workflow.
