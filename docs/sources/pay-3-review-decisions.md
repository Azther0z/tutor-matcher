---
type: raw
source: https://github.com/Azther0z/tutor-matcher/pull/224
collected: 2026-11-10
published: null
---

PR #224 review comments (verbatim):

piranatw on apps/backend/prisma/schema.prisma:29: Add "OTHER" reason for student to report other request.

piranatw on apps/backend/prisma/schema.prisma:381: Add wallet transaction id foreign key for approved requests

piranatw on docs/user-journeys.md:453: We should notify tutor that their student ask for refund. Since docs write like this so I implied that code also implement as it says. If this is not your work please reply to this comment that what US this will be implement.

piranatw on docs/user-journeys.md:436: Doc is conflicting with code. ```refund.polcy.ts:42```

piranatw on apps/frontend/src/lib/bookings-api.ts:30: never used.

piranatw on apps/backend/src/modules/refund/refund.service.ts:62: On the third conflict, attempt < 2 is false, so the raw Prisma error is rethrown and the client gets a 500, not the intended 409. The same pattern is in topup.service.ts:139 and the payout services. With four copies, a shared helper is worth extracting, which fits your "real shared seam" rule. Fix: throw the RETRY error when isTransactionConflict holds on the last attempt.

piranatw on apps/backend/src/modules/refund/refund.service.ts:44: All value are 409, try use constant instead.

piranatw on apps/frontend/app/admin/refunds/page.tsx:6: Since this component is reuse in both places (refund and topup) please rename the component to be generalize. Recommendation "StatusBadge".

kormuyang (PR comment, from E2E testing):
- Why do we have "request a refund" button when the session doesn't start yet? We should have the button shown only when the tutor clicks wht confirmation button.
- There shouldn't be two chocies. Even thought a student choose "The tutor didn't show up.", we can't be sure whether it's true or not. Should only let students type the reason and have the admin decide.

User instruction: fix everything following my friends comment

Question: kormuyang wants the 'Request a refund' button shown only after the Tutor confirms the lesson. Problem: a Tutor who didn't show up never confirms, so a missed lesson (AC1) could never be refunded. When should the button appear? (In every option a completed lesson becomes requestable and an admin decides, which is how AC3's rejection-with-reason happens.)

Answer: After the lesson ends (Recommended)

Question: kormuyang wants no reason choices: the Student just types a reason and an admin decides. piranatw asked to add an 'OTHER' reason. Which?

Answer: Just add "Other"+ text as a choice

Question: With the three choices (Tutor didn't show up / Unsatisfactory / Other + text): should 'Tutor didn't show up' still refund instantly, or go to an admin like the others? kormuyang's point was that a no-show claim can't be verified.

Answer: All go to admin (Recommended)
