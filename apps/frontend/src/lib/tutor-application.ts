import type { TutorDetails } from "@/src/lib/tutor-details";

export type TutorRecordStatus = "PENDING" | "UNPUBLISHED" | "PUBLISHED" | "REJECTED";
export type TutorApplicationStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export type TutorApplication = {
  id: string;
  avatarUrl: string | null;
  bio: string | null;
  introVideoUrl: string | null;
  identificationCardUrl: string;
  certificationUrl: string | null;
  status: TutorRecordStatus;
  enrolledAt: string;
};

export type TutorApplicationResponse = {
  status: TutorApplicationStatus;
  tutor: TutorApplication | null;
};

export type TutorEnrollmentResponse = {
  status: Exclude<TutorApplicationStatus, "NONE">;
  tutor: TutorApplication;
};

export function tutorDetailsFromApplication(application: TutorApplication | null): TutorDetails {
  return {
    avatarUrl: application?.avatarUrl ?? "",
    bio: application?.bio ?? "",
    introVideoUrl: application?.introVideoUrl ?? "",
    identificationCardUrl: application?.identificationCardUrl ?? "",
    certificationUrl: application?.certificationUrl ?? "",
  };
}
