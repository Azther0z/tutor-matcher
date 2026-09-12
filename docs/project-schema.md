# Database Schema — Tutor Matcher

This page is the canonical data model for the product. It has three inputs and states
plainly which is authoritative for what:

| Input                                                                            | Authoritative for                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`user-journeys.md`](user-journeys.md) and the prototype under `sources/`        | What the product must store — the requirement model  |
| `apps/backend/prisma/schema.prisma` + `prisma/migrations/`                       | What the database actually contains today            |
| [`sources/tutor-matcher-final-report.md`](sources/tutor-matcher-final-report.md) | The earlier database-course design — historical only |

The Final Report's schema (`Person`, `Class`, `AvailableTime`, `Payment` with transfer
proof, `Post`) described a different product and is **not** the product schema. It is
kept as immutable course evidence and summarised in
[`final-report-database-design.md`](final-report-database-design.md). Do not use it to
build application features.

Terms below follow [`CONTEXT.md`](../CONTEXT.md).

---

## Domain Shape

```
User (every account; student by default)
 ├─ tutorId  ──> Tutor ──< Subject ──< AvailabilitySubject >── Availability (30-min slot)
 │                 └──< Certification                              │
 ├─ isAdmin                                                        │
 ├─ Wallet balance ──< Payment / wallet transaction                │
 ├──< Booking >── Subject                                          │
 │      └── occupies one continuous run of ────────────────────────┘
 │      ├──< Review >── Subject
 │      └──  Payment (lesson payment)
 ├──< Message (to another User)
 └──< Report (as reporter · as reported · as handling admin)
```

Reading the shape:

- A **User** is one account. `isAdmin` layers an administrative capability onto it;
  is no separate student or tutor account record.
- A **Subject** is owned by a tutor and is what a student books.
- An **Availability** slot belongs to the tutor and is offered for one or more of that
  tutor's subjects through **AvailabilitySubject**.
- A **Booking** is one student, one subject, and one continuous run of slots.
- Money lives on the user's wallet balance and moves through **Payment** rows.

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

### tutors

| Column          | Type        | Constraints                 | Notes                                             |
| --------------- | ----------- | --------------------------- | ------------------------------------------------- |
| tutor_id        | SERIAL      | PK                          |                                                   |
| avatar_url      | TEXT        | NULL                        |                                                   |
| bio             | TEXT        | NULL                        | Listing bio                                       |
| intro_video_url | TEXT        | NULL                        |                                                   |
| government_id   | TEXT        | NOT NULL                    | Identity reference supplied when applying         |
| enrolled_at     | TIMESTAMP   | NOT NULL, DEFAULT now()     |                                                   |
| status          | TutorStatus | NOT NULL, DEFAULT `PENDING` | `PENDING`, `UNPUBLISHED`, `PUBLISHED`, `REJECTED` |

`status` currently carries both the application decision and the listing's published
state — see [Reconciliation](#reconciliation-requirement-vs-implementation).

### certifications

| Column           | Type   | Constraints                                        |
| ---------------- | ------ | -------------------------------------------------- |
| certification_id | SERIAL | PK                                                 |
| file_url         | TEXT   | NOT NULL                                           |
| tutor_id         | INT    | NOT NULL, FK → tutors.tutor_id, ON DELETE RESTRICT |

Index: `tutor_id`.

### subjects

| Column      | Type          | Constraints                                        | Notes                             |
| ----------- | ------------- | -------------------------------------------------- | --------------------------------- |
| subject_id  | SERIAL        | PK                                                 |                                   |
| name        | TEXT          | NOT NULL                                           |                                   |
| description | TEXT          | NULL                                               |                                   |
| video_url   | TEXT          | NULL                                               |                                   |
| hourly_rate | NUMERIC(10,2) | NOT NULL                                           | Lesson price is derived from this |
| tutor_id    | INT           | NOT NULL, FK → tutors.tutor_id, ON DELETE RESTRICT |                                   |

Index: `tutor_id`.

### availabilities

| Column          | Type      | Constraints                                        | Notes                                   |
| --------------- | --------- | -------------------------------------------------- | --------------------------------------- |
| availability_id | SERIAL    | PK                                                 |                                         |
| started_at      | TIMESTAMP | NOT NULL                                           | Start of a 30-minute slot               |
| booking_id      | INT       | NULL, FK → bookings.booking_id, ON DELETE SET NULL | NULL = open · set = locked to a booking |

No longer UNIQUE — a booking now claims a **continuous run** of slots, not exactly one
(closes gap G1, below).

### availability_subjects

| Column          | Type | Constraints                                                             |
| --------------- | ---- | ----------------------------------------------------------------------- |
| availability_id | INT  | PK (composite), FK → availabilities.availability_id, ON DELETE RESTRICT |
| subject_id      | INT  | PK (composite), FK → subjects.subject_id, ON DELETE RESTRICT            |

Which of the tutor's subjects that slot is offered for. This join is what makes a
subject page show subject-filtered availability.

### bookings

| Column               | Type          | Constraints                                            | Notes                                                    |
| -------------------- | ------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| booking_id           | SERIAL        | PK                                                     |                                                          |
| description          | TEXT          | NULL                                                   | The student's "what do you want to learn" note           |
| zoom_meeting_url     | TEXT          | NULL                                                   | Meeting link for the lesson; unset while payment is due  |
| created_at           | TIMESTAMP     | NOT NULL, DEFAULT now()                                |                                                          |
| status               | BookingStatus | NOT NULL, DEFAULT `PENDING_PAYMENT`                    | `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `COMPLETED` |
| is_trial             | BOOLEAN       | NOT NULL, DEFAULT true                                 |                                                          |
| total_amount         | NUMERIC(12,2) | NOT NULL                                               | Fixed at creation from the subject rate and slot count   |
| started_at           | TIMESTAMP     | NOT NULL                                               | Start of the first slot                                  |
| ended_at             | TIMESTAMP     | NOT NULL                                               | End of the last slot                                     |
| payment_expires_at   | TIMESTAMP     | NULL                                                   | The payment-hold deadline; NULL once paid or unpaid      |
| cancelled_at         | TIMESTAMP     | NULL                                                   |                                                          |
| cancellation_reason  | TEXT          | NULL                                                   |                                                          |
| user_id              | INT           | NOT NULL, FK → users.user_id, ON DELETE RESTRICT       | The student                                              |
| subject_id           | INT           | NOT NULL, FK → subjects.subject_id, ON DELETE RESTRICT | Identifies the tutor through the subject                 |
| cancelled_by_user_id | INT           | NULL, FK → users.user_id, ON DELETE SET NULL           | BOOK-4: who cancelled — the student or the tutor         |

Indexes: `user_id`, `subject_id`, `(user_id, status)`, `(status, payment_expires_at)`,
`cancelled_by_user_id`. A booking now holds a **continuous run** of slots — see
`availabilities` above — closing gaps G1-G3, below.

### payments

The wallet-transaction table.

| Column       | Type          | Constraints                                        | Notes                                          |
| ------------ | ------------- | -------------------------------------------------- | ---------------------------------------------- |
| payment_id   | SERIAL        | PK                                                 |                                                |
| type         | PaymentType   | NOT NULL                                           | `TRANSFER`, `REFUND`, `PAYOUT`                 |
| amount       | NUMERIC(12,2) | NOT NULL                                           |                                                |
| status       | PaymentStatus | NOT NULL, DEFAULT `PENDING`                        | `PENDING`, `HOLDING`, `COMPLETED`, `CANCELLED` |
| created_at   | TIMESTAMP     | NOT NULL, DEFAULT now()                            |                                                |
| completed_at | TIMESTAMP     | NULL                                               | Settlement time                                |
| from_user_id | INT           | NULL, FK → users.user_id, ON DELETE RESTRICT       | NULL = the platform side of escrow             |
| to_user_id   | INT           | NULL, FK → users.user_id, ON DELETE RESTRICT       | NULL = the platform side of escrow             |
| booking_id   | INT           | NULL, FK → bookings.booking_id, ON DELETE SET NULL | Set for a lesson payment                       |

Indexes: `from_user_id`, `to_user_id`, `booking_id`. `booking_id` is no longer UNIQUE — a
booking can now hold more than one payment (a `TRANSFER`, plus a later `REFUND` on
cancellation). While a lesson's payment is pending or held, the amount sits with the
platform (`to_user_id` NULL) rather than the tutor; the tutor is credited only on
completion.

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

| Enum            | Values                                                   |
| --------------- | -------------------------------------------------------- |
| `TutorStatus`   | `PENDING`, `UNPUBLISHED`, `PUBLISHED`, `REJECTED`        |
| `PaymentType`   | `REFUND`, `PAYOUT`, `TRANSFER`                           |
| `PaymentStatus` | `PENDING`, `HOLDING`, `COMPLETED`, `CANCELLED`           |
| `BookingStatus` | `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `COMPLETED` |

---

## Integrity Rules The Product Requires

These come from [`user-journeys.md`](user-journeys.md#invariants). Each one has to be
enforced somewhere — a constraint, a transaction, or a service-layer check — and the
"Enforced today" column says where it stands.

| #   | Rule                                                                                 | Enforced today                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A rating is between 1 and 5                                                          | ✅ CHECK `reviews_rating_stars_range`                                                                                                                                                                                           |
| 2   | An availability slot is locked to at most one booking                                | ✅ `availabilities.booking_id` is a single nullable reference — a slot cannot point at two bookings                                                                                                                             |
| 3   | A booking has at most one lesson payment                                             | ⚠️ `payments.booking_id` is no longer UNIQUE — a cancelled paid booking has a `TRANSFER` and a later `REFUND` row. At most one **active** transfer is still enforced by service-layer conditional updates, not a DB constraint. |
| 4   | A user's subjects, bookings, and payments survive referential deletes                | ✅ `ON DELETE RESTRICT` across the domain                                                                                                                                                                                       |
| 5   | A booking occupies a **continuous run** of slots for one subject                     | ✅ `bookings.availabilities` (one-to-many) plus `assertSlotBlock` enforcing a same-day, back-to-back run                                                                                                                        |
| 6   | A booking carries a lifecycle status (payment due → confirmed → completed/cancelled) | ✅ `bookings.status` (`BookingStatus`)                                                                                                                                                                                          |
| 7   | Booking price is fixed at creation from the subject rate and the slot count          | ✅ `bookings.total_amount`, computed once at creation                                                                                                                                                                           |
| 8   | A slot cannot be double-sold — the check happens before payment capture              | ✅ `createBooking` claims slots inside a Serializable transaction and verifies the claimed count before creating the payment                                                                                                    |
| 9   | Exactly one review per booking                                                       | ❌ `reviews.booking_id` is not UNIQUE                                                                                                                                                                                           |
| 10  | Every money movement records direction, status, and resulting balance                | ⚠️ partial — see gap G4                                                                                                                                                                                                         |
| 11  | Available and pending balance are distinguishable                                    | ❌ single `users.balance` — see gap G5                                                                                                                                                                                          |
| 12  | A tutor cannot open two overlapping slots                                            | ❌ no uniqueness on (tutor, `started_at`)                                                                                                                                                                                       |

---

## Reconciliation: Requirement vs Implementation

The requirement model is the prototype's data sketch,
[`sources/tutormatcher-prototype.dbml`](sources/tutormatcher-prototype.dbml). The gaps
below are the difference between it and the schema in `schema.prisma` today. They are
recorded here so the next schema change is deliberate; nothing in this list is a claim
that the current schema is wrong to have shipped.

### Gaps that block a documented journey

Gaps G1, G2, G3, and G6 (multi-slot bookings, a status column, `starts_at`/`ends_at`/
price, and a nullable `zoom_meeting_url`) were closed by the BOOK-1/BOOK-3 booking
schema. IDs are not reused once closed.

| ID  | Gap                                                                                                                                                                                                           | Journey it blocks                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| G4  | `PaymentType` has no `TOPUP` or `EARNING` value, and there is no `direction` or `balance_after`. A PromptPay top-up and a bank payout also have no counterparty user to put in `to_user_id` / `from_user_id`. | §4 Money — the whole `/wallet` ledger   |
| G5  | One `users.balance` column, so pending earnings cannot be separated from available balance. (`PaymentStatus.HOLDING` looks intended for this but is not wired to a balance split.)                            | §4 pending earnings, payout eligibility |
| G7  | `availabilities` has no tutor reference. A slot's owner is reachable only through `availability_subjects → subjects.tutor_id`, so a slot with no subject assigned has no owner.                               | §7 Availability editor                  |

### Entities the product needs that do not exist yet

| ID  | Missing                                                                                                                                                                                    | Journey                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| G8  | **Tutor application** as its own record — submitted at, reviewed at, reviewing admin, rejection reason. Today `tutors.status` conflates the application decision with listing publication. | §6 Becoming a tutor, §10 Admin |
| G9  | **Listing revision + admin review** of listing and document changes before they go live                                                                                                    | §7 Listing, §10 Admin          |
| G10 | **Payout account** (bank details, default flag)                                                                                                                                            | §4 Payouts, `/settings/wallet` |
| G11 | **Notification preference** per user and event type, with email and push flags                                                                                                             | §8 Notifications               |
| G12 | **Review reply** from the tutor, and a moderation status on reviews and messages                                                                                                           | §9 Reviews, §10 Admin          |
| G13 | **Account suspension / ban** state on `users`                                                                                                                                              | §10 Admin                      |
| G14 | **Subject format** (online / in-person) and **subject status** (draft / published / archived)                                                                                              | §2 Search filters, §7 Subjects |
| G15 | **Password reset tokens** and session storage                                                                                                                                              | §1 Password reset              |
| G16 | `reports` has no type, status, or timestamps, and `admin_user_id` is NOT NULL — a report cannot be filed before an admin picks it up                                                       | §10 Admin queues               |
| G17 | **Document type** on `certifications` (government ID vs teaching certification); the government ID is a bare string on `tutors` rather than an uploaded document                           | §6 Application, §10 Admin      |
| G18 | **Audit log** for admin decisions on content and money                                                                                                                                     | §10 Admin                      |

---

## Indexes

Present today: `subjects(tutor_id)`, `bookings(user_id)`, `bookings(subject_id)`,
`bookings(user_id, status)`, `bookings(status, payment_expires_at)`,
`bookings(cancelled_by_user_id)`, `availabilities(booking_id)`, `payments(from_user_id)`,
`payments(to_user_id)`, `payments(booking_id)`, `reviews(user_id)`,
`reviews(subject_id)`, `reviews(booking_id)`, `certifications(tutor_id)`,
`messages(from_user_id)`, `messages(to_user_id)`, `reports(admin_user_id)`,
`reports(reporter_user_id)`, `reports(reported_user_id)`, plus the unique indexes on
`users(email)` and `users(tutor_id)`. `availabilities(booking_id)` and
`payments(booking_id)` are indexed but no longer unique.

Access patterns from the journeys that are not covered yet:

| Query                                      | Suggested index                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Subject page availability for a date range | `availabilities(started_at)`, and a tutor column first once G7 is closed            |
| Open slots offered for one subject         | `availability_subjects(subject_id)`                                                 |
| A user's wallet ledger, newest first       | `payments(from_user_id, created_at DESC)` / `payments(to_user_id, created_at DESC)` |
| Search by rating and price                 | aggregate rating on the tutor or subject, plus `subjects(hourly_rate)`              |

---

## Changing This Schema

1. Change `apps/backend/prisma/schema.prisma`, generate a migration, and update the
   seed in `apps/backend/prisma/seed.ts`.
2. Update the tables above and close the matching gap row in the same change.
3. If the change alters product behaviour rather than only storage, update
   [`user-journeys.md`](user-journeys.md) and [`CONTEXT.md`](../CONTEXT.md) too.
4. Constraints Prisma cannot express go in the migration SQL with a comment, as the
   review rating check does.
