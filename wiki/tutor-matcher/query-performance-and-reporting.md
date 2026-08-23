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

# Tutor Matcher Query Performance And Reporting

## Overview

The report uses availability indexes, execution-plan comparisons, and multi-join analytical queries to support class discovery, booking views, tutor ranking, and admin monitoring.

## Indexes

- An unclustered hash index on `AvailableTime(ClassID)` supports equality searches for slots belonging to a class.
- An unclustered B-tree index on `(ClassID, AvailableDate, StartTime)` supports searches constrained by class and date/time ranges.

The report favors unclustered indexes because it expects availability rows to be inserted frequently and treats heap-file maintenance during insertion as more costly than additional heap access during searches. It notes that clustering could be applied later if it becomes worthwhile.

## Execution Path Comparison

For finding students with at least one booking, the `EXISTS` nested query can stop checking a student's bookings after the first match. A direct join may produce repeated student rows when a student has multiple bookings and then require duplicate elimination.

## Complex Query Views

- Tutor ranking combines average review, completed bookings with completed payments, class categories, and a category-partitioned rank.
- Booking reporting lists confirmed or completed bookings with student, school, class, price, tutor, schedule, payment, and review data.
- Admin monitoring finds tutors with open or in-progress reports and summarizes pending reports, active pending/confirmed bookings, average reviews, and assigned admins.

## See Also

- [Relational Database Model](relational-database-model.md)
- [Database Operations And Integrity](database-operations-and-integrity.md)
