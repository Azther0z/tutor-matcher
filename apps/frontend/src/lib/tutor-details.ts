export type TutorDetails = {
  avatarUrl: string;
  bio: string;
  introVideoUrl: string;
  identificationCardUrl: string;
};

export type TutorDetailsFieldName = keyof TutorDetails;
export type TutorDetailsFieldErrors = Partial<Record<TutorDetailsFieldName, string>>;

export const emptyTutorDetails: TutorDetails = {
  avatarUrl: "",
  bio: "",
  introVideoUrl: "",
  identificationCardUrl: "",
};

function isValidUrl(value: string) {
  try {
    const url = new URL(normalizeHttpsUrl(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeHttpsUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed || /^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
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

  return errors;
}
