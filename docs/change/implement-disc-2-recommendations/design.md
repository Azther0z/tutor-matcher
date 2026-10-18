# Design: Recommended tutor discovery

## Context

DISC-1 already implements public subject search, URL-backed filters, sorting and pagination. Its `recommended` order currently uses classes taught, review count and rating. Student learning areas and subject learning-area tags already exist. Availability slots carry open and booking state and are linked to advertised subjects. No `docs/spec/` main spec exists yet.

## Decisions

### Decision: Preserve the existing discovery surface

Change only the existing `recommended` order on `/search`; retain result granularity, filters, pagination and non-recommended sorts.

### Decision: Calculate ranking in PostgreSQL

Add an optional-auth middleware that accepts absent credentials but rejects supplied invalid credentials with the existing 401 response. For `recommended`, read the authenticated user's Student learning areas in the same discovery service and use an empty selection for users without a Student profile. Never accept an identity from query parameters.

Calculate relevance, rating, and availability in per-subject aggregates before joining them to the candidate Subjects. Use one request timestamp. Rank and page in SQL, then hydrate the page through the existing Subject mapping. Order score descending, review count descending, Subject name, Tutor names and Subject ID. Do not let duplicate area or slot rows inflate aggregates.

Use the plan's formulas and 30-day interval. Return `recommendationMode` on the response and ISO `nextAvailableAt` on each Subject result. Non-recommended sort returns null availability metadata unless the endpoint query calculates it; implementation should include it for every result as required by the agreed API. Use `Cache-Control: private, no-store` for personalized responses.

### Decision: Keep account-aware search client-side

Subscribe to the existing auth change event and read the current token only when requesting recommended results. On identity changes, abort, clear results and reset the URL page parameter. Handle 401 from recommended lookup through the established `clearAuthToken()` behavior, then retry as fallback without a token. Guard against repeated retries and stale responses.

## Implementation Notes

- `apps/backend/src/modules/discovery/`: optional-auth route, ranking query, response contract and tests.
- `apps/frontend/src/lib/discovery-api.ts` and `apps/frontend/src/components/tutor-search.tsx`: auth-aware request lifecycle and result metadata.
- `apps/frontend/src/components/subject-card.tsx` (or existing card definition): display next availability when recommended.
- `docs/user-journeys.md`, `docs/database-schema.md` and `docs/index.md`: document the new recommendation behavior and its existing data dependencies.

## Verification Commands

- Test: `npm --prefix apps/backend test -- --runInBand` and `npm --prefix apps/frontend test -- --runInBand`.
- Integration: run the discovery PostgreSQL integration suite only against the authorized isolated database.
- Build: `npm --prefix apps/backend run build` and `npm --prefix apps/frontend run build`.
- Lint: `npm --prefix apps/backend run lint` and `npm --prefix apps/frontend run lint`.
- Typecheck: `cd apps/frontend && npx --no-install tsc --noEmit`.
- Formatting: `npm run format:check` and `git diff --check`.

## Risks

- Availability aggregation must avoid duplicate rows and keep query cost bounded to the existing filtered candidate set.
- Auth transitions and 401 retry must clear old account data and avoid request loops.
- Goal-based relevance remains unsupported until Subjects have a matching goal attribute.
