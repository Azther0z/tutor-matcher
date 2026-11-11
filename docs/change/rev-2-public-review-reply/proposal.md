# Proposal: Public Tutor replies

## Intent

Deliver [REV-2, issue #169](https://github.com/Azther0z/tutor-matcher/issues/169): the reviewed Tutor can respond professionally beneath a Student's review.

## Scope

- One public reply from the reviewed Tutor, visible beneath that review and editable by its owner with an Edited marker.
- Authentication, ownership, input validation, duplicate protection and deleted-review feedback.
- Reply visibility on the Tutor and Subject review surfaces, with a shared component reusable by the Tutor dashboard.

## Approach

Store reply text, original publication time and latest edit time on Review. The user requested editable replies; one reply per review does not mean its text is immutable. Preserve REV-1 submission contracts while its PR remains open. Do not synchronize or modify a database without separate authorization.

## Affected Specs

- `review-replies`: added one editable public Tutor reply per review.

## Impact

- Review schema/API, public review projections, shared frontend component and tests.
