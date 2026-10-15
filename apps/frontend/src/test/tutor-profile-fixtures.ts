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
  certificationUrls: ["https://example.com/certificate.pdf"],
};
export const profileVersion: TutorProfileVersion = {
  ...profileFields,
  id: "33333333-3333-4333-8333-333333333333",
  userId: "user-1",
  status: "PENDING",
  createdAt: "2026-10-11T10:00:00.000Z",
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
  subjects: [],
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

// Single-version fixtures also emit the complete owner collection contract.
export function jsonApplicationResponse(body: unknown, status = 200) {
  if (body && typeof body === "object" && "version" in body && "tutor" in body) {
    const application = body as Pick<
      import("@/src/lib/tutor-application").TutorApplicationResponse,
      "status" | "tutor" | "version"
    > &
      Partial<
        Pick<
          import("@/src/lib/tutor-application").TutorApplicationResponse,
          "drafts" | "submissions" | "pendingRequest" | "latestReview" | "latestSubmittedVersion"
        >
      >;
    const version = application.version;
    return jsonResponse(
      {
        drafts: version?.status === "DRAFT" ? [version] : [],
        submissions: version && version.status !== "DRAFT" ? [version] : [],
        pendingRequest: version?.status === "PENDING" ? version : null,
        latestSubmittedVersion: version?.status !== "DRAFT" ? version : null,
        latestReview:
          version?.status === "APPROVED" || version?.status === "REJECTED" ? version : null,
        ...application,
      },
      status
    );
  }
  return jsonResponse(body, status);
}
