import type {
  TutorApplication,
  TutorProfileVersion,
  TutorReviewRequest,
} from "@/src/lib/tutor-application";

export const profileFields = {
  avatarUrl: null,
  bio: "I teach mathematics.",
  introVideoUrl: "https://example.com/intro.mp4",
  identificationCardUrl: "https://example.com/id.pdf",
  certificationUrl: "https://example.com/certificate.pdf",
};
export const profileVersion: TutorProfileVersion = {
  ...profileFields,
  id: "version-1",
  userId: "user-1",
  status: "PENDING",
  submittedAt: "2026-10-11T12:00:00.000Z",
  reviewedAt: null,
  reviewedById: null,
  rejectionReason: null,
};
export const approvedTutor: TutorApplication = {
  ...profileFields,
  id: "tutor-1",
  status: "PUBLISHED",
  enrolledAt: "2026-10-01T12:00:00.000Z",
  verified: true,
};
export const reviewRequest: TutorReviewRequest = {
  ...profileVersion,
  bio: "I now teach mathematics and physics.",
  user: { id: "user-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  currentProfile: approvedTutor,
};
export function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
