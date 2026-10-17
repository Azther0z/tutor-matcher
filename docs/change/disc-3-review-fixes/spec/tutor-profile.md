# Tutor Profile Delta Spec

## MODIFIED Requirements

### Requirement: Public profile reads do not write booking state

Loading a public tutor profile SHALL NOT invoke expired-booking cleanup or a booking write transaction. Held/booked slots SHALL remain excluded until the existing booking flow releases them.

#### Scenario: Booking cleanup is unavailable

- GIVEN a published approved tutor
- WHEN an anonymous visitor opens the profile
- THEN the profile loads without calling booking cleanup or its transaction.

### Requirement: Bound availability transfer

The detailed availability query SHALL request only future open unbooked slots within 14 days. A separate parameterized grouped query SHALL return at most one next opening per subject within the existing 92-day horizon.

#### Scenario: Subject opens after two weeks

- GIVEN a subject's next opening is 40 days away
- WHEN the profile loads
- THEN the subject's next opening is displayed while the detailed two-week list omits that slot.

### Requirement: Display reviewer names and prices consistently

Reviewer names SHALL use a complete Unicode code point for the last initial and SHALL omit the dot if the last name is empty. Header and subject-card rates SHALL use the same two-decimal currency formatting.

### Requirement: Defer and restrict media loading

Known YouTube/Vimeo embeds SHALL use lazy loading, a restricted sandbox, and an origin-preserving restrictive referrer policy. HTTPS video files SHALL use controls and no preload or autoplay. HTTP file URLs SHALL remain ordinary external links, avoiding mixed-content embedding. Non-HTTP(S) URLs SHALL not render.
