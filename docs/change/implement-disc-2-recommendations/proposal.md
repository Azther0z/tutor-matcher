# Proposal: Implement DISC-2 Recommendations

## Intent

Make `DISC-2` implementable as a real student journey. Students must be able
to save the preferences that recommendation ranking depends on, then view a
ranked list of published tutors with relevant subjects, ratings, and available
slots.

## Scope

In scope:

- Persist student subjects, level, goals, and optional schedule preferences.
- Expose an authenticated student-preference API.
- Expose an authenticated recommendation API.
- Rank published tutors using subject/goal relevance, review rating, and open
  availability.
- Provide a settings form and recommendation results page.
- Add automated API, ranking, schema, and UI verification.

Out of scope:

- The explicit search filters and pagination owned by `DISC-1`.
- Tutor profile and availability editing owned by `PROF-2` and `PROF-3`.
- Machine-learning recommendations.
- Recurring schedules, booking creation, notifications, and payment behavior.

## Approach

Add a one-to-one student profile linked to `User`, with a normalized list of
student subject interests and schedule preferences. Add a deterministic,
explainable ranking service that uses existing tutor subjects, bios, reviews,
and unbooked availability. If no usable student preferences exist, fall back
to rating and availability rather than claiming personalization.

## Affected Specs

- `student-preferences`: added student preference storage and submission behavior.
- `discovery-recommendations`: added ranked recommendations and fallback behavior.

## Impact

- `apps/backend/prisma/schema.prisma`: add student preference models and relations.
- `apps/backend/prisma/migrations/`: add the forward migration.
- `apps/backend/src/modules/profile/`: add the student preference API.
- `apps/backend/src/modules/discovery/`: add recommendation querying and ranking.
- `apps/frontend/app/settings/page.tsx`: replace the placeholder with preference editing.
- `apps/frontend/app/search/page.tsx`: replace the placeholder with recommendations.
- `docs/backlog/product-backlog/DISC-2-to-view-a-ranked-list-of-recommended-tutors.yaml`:
  implementation status can move only after verification passes.
