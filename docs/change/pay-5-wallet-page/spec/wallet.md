# Wallet Delta Spec

## ADDED Requirements

### Requirement: One wallet overview

The system SHALL show each logged-in user one available balance on `/wallet`, read from the
same stored balance as the navbar, plus pending earnings (Tutors only), earnings this month
and all-time paid out.

#### Scenario: A Student who is also a Tutor

- GIVEN a user with top-up money and LESSON_EARNING rows
- WHEN they open `/wallet`
- THEN one available balance includes both, and no second balance is shown

#### Scenario: Pending earnings

- GIVEN a Tutor with CONFIRMED bookings
- WHEN they open `/wallet`
- THEN pending earnings equal the sum of each booking's total minus the 15% platform fee,
  rounded to cents per booking, and no ledger row is written

#### Scenario: Not a Tutor

- GIVEN a user who is not a Tutor
- WHEN they open `/wallet`
- THEN pending earnings are not shown

#### Scenario: Earnings this month and paid out

- GIVEN LESSON_EARNING and PAYOUT rows
- WHEN the overview loads
- THEN earnings this month sum LESSON_EARNING rows in the current Asia/Bangkok calendar month,
  and all-time paid out sums every PAYOUT row

### Requirement: One filterable transaction list

The system SHALL list only the user's own Wallet Transactions, newest first and paged, with a
filter of All / Top-ups / Lesson payments / Lesson earnings / Payouts / Refunds.

#### Scenario: Every type in one list

- GIVEN TOP_UP, LESSON_PAYMENT, LESSON_EARNING, REFUND and PAYOUT rows
- WHEN `/wallet` opens with All selected
- THEN all of them appear with a sign that follows the type

#### Scenario: Filter

- WHEN the user picks a type filter
- THEN only rows of that type are listed, and the filter is kept in the URL

#### Scenario: Unknown filter

- WHEN the API receives an unknown type or a page below 1
- THEN it returns 400 and reads nothing

### Requirement: Payment due stays on the booking

The system SHALL NOT show unpaid bookings in wallet history or accept payment on any wallet
page. `/wallet` SHALL show a Payment due notice for the user's PENDING_PAYMENT bookings whose
hold has not expired, each linking to `/bookings/:id` to pay there.

#### Scenario: Unpaid booking

- GIVEN a booking in PENDING_PAYMENT
- WHEN the user opens `/wallet`
- THEN it appears only in the Payment due notice, with a link to `/bookings/:id`, and no
  transaction row exists for it

### Requirement: Read-only transaction detail

The system SHALL show `/wallet/transactions/:id` to its owner with type, signed amount,
direction (In for TOP_UP, LESSON_EARNING and REFUND; Out for LESSON_PAYMENT and PAYOUT),
status Completed, date, resulting balance, the related booking (if any) and the masked payout
account for a payout. It SHALL offer no payment or edit action.

#### Scenario: Lesson payment

- GIVEN a LESSON_PAYMENT row
- WHEN its owner opens the detail page
- THEN it links to `/bookings/:id` and says payment is made only from the booking page

#### Scenario: Another user's or unknown transaction

- WHEN a user opens a transaction that is not theirs, does not exist, or has a malformed id
- THEN the API returns 404 (400 for a malformed id) and the page says it was not found
