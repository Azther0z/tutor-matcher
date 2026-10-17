# Proposal: Recommended tutor discovery

## Intent

Implement issue [#149](https://github.com/Azther0z/tutor-matcher/issues/149) by ranking the existing `/search` subject results using student learning-area relevance, subject rating and next availability.

## Scope

In scope:

- Personalized recommendations for authenticated students and a general fallback for other searches.
- Rank before pagination and retain the existing subject-level result model and filters.
- Show recommendation mode and each subject's next available slot.
- Add acceptance coverage and update canonical discovery documentation.

Out of scope:

- Matching student goals, schema changes, migrations, ML ranking, and deployment/CI changes.
- Replacing non-recommended sort behavior.

## Approach

Extend the existing discovery endpoint with optional authentication. For `recommended`, calculate normalized relevance, rating and availability scores in PostgreSQL before paging. Use a stable tie-break order and return the selected recommendation mode and next available time.

## Affected Specs

- `tutor-recommendations`: added personalized and fallback ranked discovery behavior.

## Impact

- Discovery API and PostgreSQL query, `/search` result state and cards, discovery tests, and canonical journey documentation.
