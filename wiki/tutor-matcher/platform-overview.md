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

# Tutor Matcher Platform Overview

## Overview

Tutor Matcher is a match-making platform intended to connect tutors and students whose needs align in subject, schedule, and price. The Final Report documents the database part of this platform; application software architecture is not defined yet.

## Objectives

The documented database is intended to support a complete match-maker workflow, tutor schedule and content management, student search and booking, transparent payment, and admin handling of disputes and usage problems.

## Functional Areas

- Member management for Tutor, Student, and Admin roles.
- Tutor functions for classes, per-hour pricing, education history, 30-minute availability slots, and promotional posts.
- Student functions for searching by price, review score, and subject category; selecting available times; booking; and reviewing completed lessons.
- Payment functions for transfer proof and payment-status tracking.
- Admin and report functions for investigating and responding to user problems.

## Scope Boundary

This article summarizes product capabilities represented in the database report. It does not specify application layers, services, APIs, clients, deployment, authentication architecture, or integration boundaries.

## See Also

- [Relational Database Model](relational-database-model.md)
- [Booking, Payment, and Integrity Rules](database-operations-and-integrity.md)
- [Query Performance and Reporting](query-performance-and-reporting.md)
- [Document Database Model](document-database-model.md)
