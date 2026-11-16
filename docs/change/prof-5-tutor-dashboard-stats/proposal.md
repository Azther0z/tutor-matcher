# Proposal: Tutor teaching statistics

## Intent

Deliver [PROF-5, issue #165](https://github.com/Azther0z/tutor-matcher/issues/165): an approved Tutor can understand teaching activity, student engagement and published reviews from the Tutor dashboard.

## Scope

- Tutor-owned lesson and student statistics, booking status and engagement.
- Published review count, aggregate rating and recent review information.
- Empty, loading and recoverable error states; Student isolation.
- Public Tutor profile teaching-experience totals, available to Students and visitors; only the management dashboard is owner-only.

## Approach

Read the current schema without changing it. Use Booking as the lesson unit rather than half-hour slots. Keep confirmed lessons distinct from completed lessons. Keep the existing confirmation, upcoming lessons and availability workflows.

## Affected Specs

- `tutor-dashboard`: added teaching statistics and reviews.

## Impact

- Dashboard API, Tutor tab, automated tests and journey definitions.
