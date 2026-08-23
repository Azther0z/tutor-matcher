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

# Tutor Matcher Document Database Model

## Overview

The document-based design embeds reviews inside a Class document because class details and reviews are commonly displayed together when a student considers a class.

## Class Document

The schema requires `_id`, `tutorid`, `classname`, and `priceperhour`. It also supports an optional description and a `reviews` array. Each review object contains required `reviewid`, `studentid`, and `ratingscore` fields, with optional `bookingid`, `comment`, and review date fields.

## Intended Use

The report presents the model for MongoDB usage and includes an insert example using MongoDB Compass. The embedded shape is intended for read patterns that retrieve class details and its reviews together.

## See Also

- [Tutor Matcher Platform Overview](platform-overview.md)
- [Relational Database Model](relational-database-model.md)
