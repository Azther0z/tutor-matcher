import { clearAuthToken, getAuthToken } from "@/src/lib/auth";
import { normalizeHttpsUrl, type TutorDetails } from "@/src/lib/tutor-details";

export type TutorRecordStatus = "UNPUBLISHED" | "PUBLISHED";
export type TutorVersionStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type TutorProfileFields = {
  avatarUrl: string | null;
  bio: string | null;
  introVideoUrl: string | null;
  identificationCardUrl: string | null;
  certificationUrl?: string | null;
  certificationUrls: string[];
};
export type TutorApplication = TutorProfileFields & {
  id: string;
  status: TutorRecordStatus;
  enrolledAt: string;
  verified: boolean;
};
export type TutorProfileVersion = TutorProfileFields & {
  id: string;
  userId: string;
  status: TutorVersionStatus;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  rejectionReason: string | null;
};
export type TutorApplicationResponse = {
  status: TutorVersionStatus | "NONE";
  tutor: TutorApplication | null;
  version: TutorProfileVersion | null;
  drafts: TutorProfileVersion[];
  submissions: TutorProfileVersion[];
  pendingRequest: TutorProfileVersion | null;
  latestReview: TutorProfileVersion | null;
  latestSubmittedVersion: TutorProfileVersion | null;
};
// SAFE-2: an identity or certification URL whose file extension blocks approval.
export type TutorDocumentIssue = {
  document: "identificationCard" | "certification";
  url: string;
  extension: string;
};
export type TutorReviewRequest = TutorProfileVersion & {
  user: { id: string; firstName: string; lastName: string; email: string };
  currentProfile: TutorApplication | null;
  documentIssues?: TutorDocumentIssue[];
};

export function getTutorCertificationUrls(profile: TutorProfileFields | null): string[] {
  return (
    profile?.certificationUrls ?? (profile?.certificationUrl ? [profile.certificationUrl] : [])
  );
}

export function tutorDetailsFromApplication(profile: TutorProfileFields | null): TutorDetails {
  return {
    avatarUrl: profile?.avatarUrl ?? "",
    bio: profile?.bio ?? "",
    introVideoUrl: profile?.introVideoUrl ?? "",
    identificationCardUrl: profile?.identificationCardUrl ?? "",
    certificationUrls: [...getTutorCertificationUrls(profile)],
  };
}

export function tutorDetailsPayload(details: TutorDetails): TutorProfileFields {
  return {
    avatarUrl: normalizeHttpsUrl(details.avatarUrl) || null,
    bio: details.bio.trim() || null,
    introVideoUrl: normalizeHttpsUrl(details.introVideoUrl) || null,
    identificationCardUrl: normalizeHttpsUrl(details.identificationCardUrl) || null,
    certificationUrls: [
      ...new Set(details.certificationUrls.map(normalizeHttpsUrl).filter(Boolean)),
    ],
  };
}

export class TutorApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function tutorApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new TutorApiError("Please log in to continue.", 401);
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) clearAuthToken();
    const serverMessage = data?.message;
    const message = Array.isArray(serverMessage) ? serverMessage.join(" ") : serverMessage;
    throw new TutorApiError(
      response.status === 403
        ? "You do not have permission to perform this action."
        : typeof message === "string"
          ? message
          : "Could not complete the request. Please try again.",
      response.status
    );
  }
  if (data === null) throw new Error("The server returned an empty response. Please refresh.");
  return data as T;
}
