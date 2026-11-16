# Design: Tutor teaching statistics

## Context

`docs/user-journeys.md` owns behavior, `CONTEXT.md` owns vocabulary, and the current Prisma schema owns storage. Main already separates Student and Tutor dashboard tabs. Reviews belong to Subjects owned by Tutors; there is no review publication-state field, so extant reviews are published.

## Decisions

- Count Booking records as lessons; booking duration must not multiply lesson count.
- Student engagement measures actual teaching bookings, excluding unpaid and cancelled bookings. Show the definition near the metric.
- Completed means Tutor-confirmed `COMPLETED`; elapsed scheduled time does not imply completion.
- Compute rating from all of the Tutor's published reviews. Unrated is distinct from zero stars.
- Authentication and Tutor ownership are enforced in the API as well as the UI.
- Reply editing is REV-2's separate responsibility; reuse its reply display contract during the combined preview.

## Verification Commands

- Backend: `npm --prefix apps/backend test -- --runInBand`
- Frontend: `npm --prefix apps/frontend test -- --runInBand`
- Build: `npm --prefix apps/backend run build`; `npm --prefix apps/frontend run build`
- Lint: `npm --prefix apps/backend run lint`; `npm --prefix apps/frontend run lint`
- Formatting: Prettier check on changed managed files.

## Risks

- A recent-review list must not accidentally become the rating denominator.
- Mocked preview data demonstrates interaction; it is not PostgreSQL integration evidence.

## Dashboard preview feedback

Use the implemented theme on latest main: neutral light/dark panels, gray borders and
violet interaction accents. Palette comments in globals are not a reason to recolor the
dashboard. The review list uses a contained, keyboard-focusable scroll area with a
rounded, theme-aware scrollbar. Native form controls use the matching color scheme.

Students and visitors can evaluate the Tutor through public ratings/reviews plus
completed-lesson and distinct-learner totals on the existing published profile. Only
Tutor-confirmed COMPLETED Bookings contribute; the totals are activity evidence, not
a teaching-quality score. Private status/engagement details stay on the owner dashboard.

Availability/calendar and navbar experiments from the local preview are excluded from
this story's PR. REV-2 supplies the shared reply component and reply storage; merge it first.
