// IDs and values created by apps/backend/prisma/seed-e2e.ts.
export const NINA = {
  tutorId: "00000000-0000-4000-8000-0000000000a1",
  subjectId: "00000000-0000-4000-8000-0000000000b1",
  tutorName: "Nina Algebra",
  subject: "E2E Algebra Basics",
  rate: "100.00",
};
export const OSCAR = {
  tutorId: "00000000-0000-4000-8000-0000000000a2",
  subjectId: "00000000-0000-4000-8000-0000000000b2",
  tutorName: "Oscar Physics",
  subject: "E2E Physics Mechanics",
  rate: "500.00",
};
export const PRIYA = {
  tutorId: "00000000-0000-4000-8000-0000000000a3",
  subjectId: "00000000-0000-4000-8000-0000000000b3",
  tutorName: "Priya Chemistry",
  subject: "E2E Chemistry Lab",
  rate: "900.00",
};
// Unpublished tutor: must never appear anywhere public.
export const QUINN = {
  tutorId: "00000000-0000-4000-8000-0000000000a4",
  subjectId: "00000000-0000-4000-8000-0000000000b4",
  subject: "E2E Hidden Subject",
};

// Every E2E subject name starts with this, which scopes a search to the seeded data.
export const E2E_KEYWORD = "E2E";
