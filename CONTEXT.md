---
name: tutor-matcher
description: Domain vocabulary for the Tutor Matcher platform.
---

# Tutor Matcher

A matchmaking platform that connects tutors and students by subject, schedule, and price.

## Language

**Tutor**:
A registered member who offers classes, sets hourly pricing, declares availability, and accepts bookings.
_Avoid_: Teacher, instructor, provider

**Student**:
A registered member who searches for tutors, books available time slots, makes payments, and leaves reviews.
_Avoid_: Learner, client, user

**Admin**:
A registered member with elevated access who investigates reports and resolves disputes between tutors and students.
_Avoid_: Moderator, staff, superuser

**Class**:
A tutoring offering created by a tutor, with a subject category, hourly price, and description.
_Avoid_: Course, session, subject

**Availability Slot**:
A 30-minute date/time window a tutor attaches to a class, which becomes reserved once a booking is confirmed.
_Avoid_: Time slot, open slot, schedule entry

**Booking**:
A student's request to occupy one or more availability slots for a class, carrying a status (pending, confirmed, cancelled, completed).
_Avoid_: Reservation, appointment, order

**Payment**:
The record of a student's transfer proof and payment status tied to a booking.
_Avoid_: Transaction, order, charge

**Transfer Proof**:
Evidence (typically an image of a bank slip) submitted by a student to confirm a payment was made.
_Avoid_: Receipt, screenshot, payment proof

**Review**:
A rating and comment left by a student on a completed booking.
_Avoid_: Feedback, rating, testimonial

**Report**:
A dispute or complaint filed by any member against another member, handled by an Admin.
_Avoid_: Ticket, complaint, issue

**Post**:
A promotional piece of content authored by a tutor, optionally linked to a specific class.
_Avoid_: Announcement, listing, advertisement
