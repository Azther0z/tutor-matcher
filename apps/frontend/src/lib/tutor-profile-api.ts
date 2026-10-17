import type { SubjectOffering } from "@/src/lib/subjects";

// DISC-3: what the public tutor profile page shows.
export type ProfileSubject = SubjectOffering & {
  rating: number | null;
  reviewCount: number;
  nextOpening: string | null;
};

export type ProfileOpening = { startedAt: string; subjectIds: string[] };

export type ProfileReview = {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  subjectName: string;
  reviewer: string;
};

export type TutorProfile = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  verified: boolean;
  bio: string | null;
  avatarUrl: string | null;
  introVideoUrl: string | null;
  rating: number | null;
  reviewCount: number;
  subjects: ProfileSubject[];
  availability: ProfileOpening[];
  reviews: ProfileReview[];
};

export type ProfileResult = { kind: "profile"; profile: TutorProfile } | { kind: "unavailable" };

// A 404 means the tutor is unpublished or missing: the page shows no details for it.
export async function getTutorProfile(tutorId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/discovery/tutors/${encodeURIComponent(tutorId)}/profile`, {
    signal,
  });
  if (response.status === 404) return { kind: "unavailable" } satisfies ProfileResult;
  const data = (await response.json().catch(() => null)) as TutorProfile | null;
  if (!response.ok || data === null) throw new Error("Could not load this tutor's profile.");
  return { kind: "profile", profile: data } satisfies ProfileResult;
}

export type VideoSource =
  { kind: "embed"; src: string } | { kind: "file"; src: string } | { kind: "link"; src: string };

// Only http(s) links are used. YouTube and Vimeo play inline, video files use a player,
// and any other address stays a plain link.
export function videoSource(url: string | null): VideoSource | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.replace(/^www\./, "");
  let youtubeId: string | null = null;
  if (host === "youtu.be") youtubeId = parsed.pathname.slice(1);
  else if (host === "youtube.com" || host === "m.youtube.com") {
    youtubeId =
      parsed.searchParams.get("v") ??
      parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ??
      null;
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${youtubeId}` };
  }

  const vimeoId = host === "vimeo.com" ? parsed.pathname.match(/^\/(\d+)/)?.[1] : null;
  if (vimeoId) return { kind: "embed", src: `https://player.vimeo.com/video/${vimeoId}` };

  if (/\.(mp4|webm|ogg)$/i.test(parsed.pathname)) return { kind: "file", src: parsed.href };
  return { kind: "link", src: parsed.href };
}

const bangkok = "Asia/Bangkok";

// Openings are shown in the tutor's timezone, which is also how slots are published.
export function openingDay(startedAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: bangkok,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(startedAt));
}

export function openingTime(startedAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: bangkok,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(startedAt));
}

export function openingDateTime(startedAt: string) {
  return `${openingDay(startedAt)}, ${openingTime(startedAt)}`;
}

export function groupOpeningsByDay(openings: ProfileOpening[]) {
  const days = new Map<string, ProfileOpening[]>();
  for (const opening of openings) {
    const day = openingDay(opening.startedAt);
    days.set(day, [...(days.get(day) ?? []), opening]);
  }
  return [...days].map(([day, slots]) => ({ day, slots }));
}
