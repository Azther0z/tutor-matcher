export type TutorDetails = {
  avatarUrl: string;
  bio: string;
  introVideoUrl: string;
  identificationCardUrl: string;
  certificationUrl: string;
};

export type TutorDetailsFieldName = keyof TutorDetails;
export type TutorDetailsFieldErrors = Partial<Record<TutorDetailsFieldName, string>>;

export const emptyTutorDetails: TutorDetails = {
  avatarUrl: "",
  bio: "",
  introVideoUrl: "",
  identificationCardUrl: "",
  certificationUrl: "",
};

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateTutorDetails(values: TutorDetails): TutorDetailsFieldErrors {
  const errors: TutorDetailsFieldErrors = {};

  if (values.avatarUrl.trim() && !isValidUrl(values.avatarUrl)) {
    errors.avatarUrl = "Enter a valid avatar URL.";
  }

  if (!values.bio.trim()) {
    errors.bio = "Tutor bio is required.";
  }

  if (!values.introVideoUrl.trim()) {
    errors.introVideoUrl = "Intro video URL is required.";
  } else if (!isValidUrl(values.introVideoUrl)) {
    errors.introVideoUrl = "Enter a valid intro video URL.";
  }

  if (!values.identificationCardUrl.trim()) {
    errors.identificationCardUrl = "Identification card URL is required.";
  } else if (!isValidUrl(values.identificationCardUrl)) {
    errors.identificationCardUrl = "Enter a valid identification card URL.";
  }

  if (!values.certificationUrl.trim()) {
    errors.certificationUrl = "A teaching certification document is required.";
  } else if (!isValidUrl(values.certificationUrl)) {
    errors.certificationUrl = "Enter a valid certification document URL.";
  }

  return errors;
}
