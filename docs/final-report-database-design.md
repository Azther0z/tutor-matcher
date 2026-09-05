---
type: article
sources:
  - name: Tutor Matcher team, Final Report
    date: null
raw:
  - docs/sources/tutor-matcher-final-report.md
updated: 2026-09-05
statuses: []
---

# Final Report Database Design

> **Scope: historical course evidence.** This page summarises the database-course Final
> Report, whose schema (`Person`, `Class`, `AvailableTime`, transfer-proof `Payment`,
> `Post`) describes an earlier, different design. It is **not** the product's data model
> and must not be used to build application features. The product data model is
> [Database Schema](project-schema.md); the product's behaviour is
> [User Journeys](user-journeys.md).

It is kept because the report is a graded course deliverable and the reasoning in it —
procedure design, trigger placement, index trade-offs — is worth reading on its own
terms. Three separate pages previously covered the sections below; they were merged here
because they summarise one source and share one purpose.

## Relational Operations And Integrity

The report demonstrates relational data manipulation, booking procedures, stored
functions, triggers, and constraint enforcement for its database.

### Data manipulation constraints

The examples demonstrate failures caused by duplicate primary keys, duplicate unique
values such as usernames, foreign keys that reference missing parent rows, and updates
that violate non-null constraints. Deleting a `Person` can cascade to its role-specific
`Student` record, while deleting the child record does not remove the parent.

### Booking procedures

- `sp_confirm_booking` locks a booking, requires the current status to be `Pending`,
  changes it to `Confirmed`, and inserts a `Pending` payment in the same transaction.
- `sp_cancel_booking` rejects cancellation of already cancelled, completed, or confirmed
  bookings; marks a cancellable booking `Cancelled`; appends the reason to
  `StudentMessage`; and releases its time slots by clearing `BookingID` and setting
  availability.

### Stored functions

- `fn_get_tutor_earnings` sums class-time price for a tutor over a date range, counting
  only `Completed` bookings with `Completed` payments.
- `fn_class_rating_summary` returns a class's average rating rounded to two decimal
  places and its review count.

### Triggers

- `trg_sync_slot_availability` keeps `IsAvailable` consistent with `BookingID`: null
  means available and non-null means unavailable.
- `trg_validate_review_eligibility` allows a review only when the student has a
  `Completed` booking for the class.

## Query Performance And Reporting

The report uses availability indexes, execution-plan comparisons, and multi-join
analytical queries to support class discovery, booking views, tutor ranking, and admin
monitoring.

### Indexes

- An unclustered hash index on `AvailableTime(ClassID)` supports equality searches for
  slots belonging to a class.
- An unclustered B-tree index on `(ClassID, AvailableDate, StartTime)` supports searches
  constrained by class and date/time ranges.

The report favors unclustered indexes because it expects availability rows to be
inserted frequently and treats heap-file maintenance during insertion as more costly
than additional heap access during searches. It notes that clustering could be applied
later if it becomes worthwhile.

### Execution path comparison

For finding students with at least one booking, the `EXISTS` nested query can stop
checking a student's bookings after the first match. A direct join may produce repeated
student rows when a student has multiple bookings and then require duplicate
elimination.

### Complex query views

- Tutor ranking combines average review, completed bookings with completed payments,
  class categories, and a category-partitioned rank.
- Booking reporting lists confirmed or completed bookings with student, school, class,
  price, tutor, schedule, payment, and review data.
- Admin monitoring finds tutors with open or in-progress reports and summarizes pending
  reports, active pending/confirmed bookings, average reviews, and assigned admins.

## Document Database Model

The document-based design embeds reviews inside a Class document because class details
and reviews are commonly displayed together when a student considers a class.

### Class document

The schema requires `_id`, `tutorid`, `classname`, and `priceperhour`. It also supports
an optional description and a `reviews` array. Each review object contains required
`reviewid`, `studentid`, and `ratingscore` fields, with optional `bookingid`, `comment`,
and review date fields.

### Intended use

The report presents the model for MongoDB usage and includes an insert example using
MongoDB Compass. The embedded shape is intended for read patterns that retrieve class
details and its reviews together.

## See Also

- [Database Schema](project-schema.md) — the product's data model
- [User Journeys](user-journeys.md) — the product's behaviour
- [Final Report](sources/tutor-matcher-final-report.md) — the immutable source
