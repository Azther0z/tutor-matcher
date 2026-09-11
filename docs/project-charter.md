# Project Charter — Tutor Matcher

## Overview

Tutor Matcher is a matchmaking platform that connects tutors and students whose needs
align in subject, schedule, and price. A student finds a tutor, opens one of that
tutor's subjects, picks a continuous block of the tutor's published 30-minute slots, and
pays for it from a single wallet balance. Paying confirms the lesson immediately —
there is no tutor approval step, because the tutor already published the slot.

The behaviour this charter commits to is described in
[`user-journeys.md`](user-journeys.md) and grounded in the product prototype preserved
under [`sources/`](sources/).

## Problem Statement

Finding a tutor who matches a student's required subject, preferred schedule, and budget
is fragmented and manual, and paying for lessons usually means bank transfers and
screenshots. Tutor Matcher centralises discovery, slot-level booking, and money in one
place: transparent search, subject-specific availability, instant paid confirmation, and
one auditable wallet ledger for every movement of money.

## Goals

1. Let tutors publish a verified public listing, run each teaching offering as its own
   subject with its own rate, and open 30-minute availability slots per subject.
2. Let students search and filter tutors, evaluate a specific subject, book one
   continuous 1-1 block from published availability, and pay from wallet balance.
3. Confirm lessons instantly on payment, deliver them through an attached online meeting
   link, and complete them automatically so settlement and reviewing can start.
4. Hold all money in one wallet per user — top-ups in, lesson payments out, cleared
   earnings in, refunds in, payouts out — with the transaction ledger as the source of
   truth for every balance.
5. Give admins the queues that keep the marketplace trustworthy: tutor applications,
   listing and document changes, flagged content, payment disputes, and account
   suspension.

## Roles

Every account is created as a student. Tutor and admin are capabilities layered onto the
same account, not separate account types.

| Role        | What the capability adds                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Student** | Default for every account: search, message a tutor, book and pay for lessons, attend, review completed lessons, top up and withdraw    |
| **Tutor**   | Granted on approved application: public listing, subjects, per-date availability, teaching confirmed classes, earnings into the wallet |
| **Admin**   | Tutor applications, listing and document review, content moderation, disputes and refunds, suspension and bans                         |

## Scope

**In scope:** account sign-up and login; tutor application with identity and
certification documents; admin-reviewed public listings; per-tutor subjects; per-date
30-minute availability with subject assignment; tutor and subject discovery with
filters; subject-locked 1-1 booking of a continuous block; wallet top-up by PromptPay,
wallet-funded lesson payment, earnings, refunds, and payouts for any user; online lesson
delivery by meeting link and automatic completion; student ⇄ tutor messaging and
notification preferences; reviews scoped to a tutor and a subject, with tutor replies and
flagging; admin queues for applications, moderation, disputes, and account safety.

**Out of scope:** native mobile apps in the initial release, plus the features listed
under [User Journeys → Explicitly out of scope](user-journeys.md#explicitly-out-of-scope)
— role selection at sign-up, recurring bookings, group lessons, lesson credits, saved
payment methods, transfer-proof upload, and tutor promotional posts. That list is
maintained there so there is one place to change it.

## Team

Group 2 — G2: ซานต้า
Computer Engineering, Year 2
Kritarat Moonmanee, Natdanai Hirunsirikul, Teerachot Kerdlapanan, Nontakorn Krairaveeroj, Nonthapat Sriboonruang, Passatorn Jindawong, Phantakan Thepnakorn, Puntawit Masun, Piranat Wadlom, Nathawat Wattanarapeepong
