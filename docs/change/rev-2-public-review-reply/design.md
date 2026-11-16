# Design: Public Tutor replies

## Context

The user clarified that the reviewed Tutor must be able to edit the single public reply. Main has no reply fields; REV-1 owns review creation. Review stores `replyText`, `repliedAt` and `replyEditedAt`; no database synchronization is authorized.

## Decisions

- Store one editable reply on Review. Preserve the original publication timestamp and store the latest actual edit separately.
- `POST /api/reviews/:id/reply` accepts trimmed `text` of 1–2000 characters and returns the public reply.
- `PATCH /api/reviews/:id/reply` accepts the same text and `expectedUpdatedAt` from the displayed reply. Compare it to editedAt or the original publication date and use a conditional write; stale or concurrent edits receive 409. Identical text is a no-op without a false Edited marker.
- Verify the current Tutor and review ownership on the server. Use a conditional write to prevent overwrite races.
- Return a specific not-found error if deletion wins the race; preserve the user's draft on failure.
- Use one shared reply component on public Tutor and Subject pages; PROF-5 can reuse it on the owner dashboard. Student and visitor surfaces show public replies without reply controls.

## Verification Commands

- Backend: `npm --prefix apps/backend test -- --runInBand`
- Frontend: `npm --prefix apps/frontend test -- --runInBand`
- Build: Both app build commands.
- Lint: Both app lint commands and changed-file Prettier check.
- Schema: `npm --prefix apps/backend run prisma:validate` and Prisma client generation only.

## Risks

- Existing databases need an authorized schema synchronization before runtime use of the new fields.
- REV-1 must be rechecked before opening the final PR; no unrelated upstream PR is merged by this task.
