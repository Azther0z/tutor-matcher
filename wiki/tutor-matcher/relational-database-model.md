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

# Tutor Matcher Relational Database Model

## Overview

The relational design models shared identity, role-specific profiles, classes, categories, schedules, bookings, payments, reviews, reports, and tutor posts. It uses primary and foreign keys to preserve relationships between these areas.

## Relations

- `PostalAddress` stores postal code, province, and district.
- `Person` stores shared account, identity, contact, profile, and login timestamps.
- `Tutor`, `Student`, and `Admin` specialize `Person` by `PersonID`.
- `TutorEducationBackground` stores a tutor's institutions, degree levels, fields, and graduation years.
- `StudentInterestedCategory` stores subject categories a student is interested in.
- `Class` stores a tutor's class, hourly price, and description; `ClassCategory` assigns categories.
- `AvailableTime` stores class date/time slots and their booking association.
- `Booking` stores the student request, message, status, and booking timestamp.
- `Payment` stores booking payment status, method, proof, and timestamp.
- `Review` stores student feedback, rating, comment, and review time.
- `Report` stores reporter, reported person, optional admin handler, issue details, evidence, status, and response.
- `Post` stores tutor-authored promotional content optionally associated with a class.

## Normalization

The report states that all relations except `Person` are in Third Normal Form. `Person` has the transitive dependency `PersonID -> PostalCode -> Province, District`; separating postal data into `PostalAddress` removes that dependency.

## See Also

- [Tutor Matcher Platform Overview](platform-overview.md)
- [Booking, Payment, and Integrity Rules](database-operations-and-integrity.md)
- [Document Database Model](document-database-model.md)
