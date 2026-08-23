---
type: article
sources:
  - name: Tutor Matcher team, Final Report
    date: null
raw:
  - raw/tutor-matcher-final-report.md
updated: 2026-08-23
statuses: []
---

# Tutor Matcher Database Operations And Integrity

## Overview

The report demonstrates relational data manipulation, booking procedures, stored functions, triggers, and constraint enforcement for the Tutor Matcher database.

## Data Manipulation Constraints

The examples demonstrate failures caused by duplicate primary keys, duplicate unique values such as usernames, foreign keys that reference missing parent rows, and updates that violate non-null constraints. Deleting a `Person` can cascade to its role-specific `Student` record, while deleting the child record does not remove the parent.

## Booking Procedures

- `sp_confirm_booking` locks a booking, requires the current status to be `Pending`, changes it to `Confirmed`, and inserts a `Pending` payment in the same transaction.
- `sp_cancel_booking` rejects cancellation of already cancelled, completed, or confirmed bookings; marks a cancellable booking `Cancelled`; appends the reason to `StudentMessage`; and releases its time slots by clearing `BookingID` and setting availability.

## Stored Functions

- `fn_get_tutor_earnings` sums class-time price for a tutor over a date range, counting only `Completed` bookings with `Completed` payments.
- `fn_class_rating_summary` returns a class's average rating rounded to two decimal places and its review count.

## Triggers

- `trg_sync_slot_availability` keeps `IsAvailable` consistent with `BookingID`: null means available and non-null means unavailable.
- `trg_validate_review_eligibility` allows a review only when the student has a `Completed` booking for the class.

## See Also

- [Relational Database Model](relational-database-model.md)
- [Tutor Matcher Platform Overview](platform-overview.md)
