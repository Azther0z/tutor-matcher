import { getAuthToken } from "./auth";

export type TutorDashboard = {
  tutorId: string;
  classesThisWeek: number;
  week: { start: string; end: string };
  lessons: { completed: number; confirmed: number; pendingPayment: number; cancelled: number };
  students: {
    total: number;
    withCompletedLessons: number;
    returning: number;
    returningRate: number | null;
  };
  reviews: {
    count: number;
    averageRating: number | null;
    recent: {
      id: string;
      flaggedByMe?: boolean;
      ratingStars: number;
      text: string | null;
      createdAt: string;
      studentName: string;
      subject: { id: string; name: string };
      reply?: { text: string; repliedAt: string; editedAt?: string | null } | null;
    }[];
  };
};

export async function getTutorDashboard(): Promise<TutorDashboard> {
  const token = getAuthToken();
  const response = await fetch("/api/dashboard/tutor", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message ?? "Could not load your teaching overview. Please try again.");
  }
  return data as TutorDashboard;
}
