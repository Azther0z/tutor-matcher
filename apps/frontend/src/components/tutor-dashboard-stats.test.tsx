import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getTutorDashboard, type TutorDashboard } from "../lib/dashboard-api";
import { TutorDashboardStats } from "./tutor-dashboard-stats";

jest.mock("../lib/dashboard-api", () => ({ getTutorDashboard: jest.fn() }));
const load = jest.mocked(getTutorDashboard);
const empty: TutorDashboard = {
  tutorId: "tutor-1",
  classesThisWeek: 0,
  week: { start: "2026-11-08T17:00:00Z", end: "2026-11-15T17:00:00Z" },
  lessons: { completed: 0, confirmed: 0, pendingPayment: 0, cancelled: 0 },
  students: { total: 0, withCompletedLessons: 0, returning: 0, returningRate: null },
  reviews: { count: 0, averageRating: null, recent: [] },
};

beforeEach(() => {
  localStorage.clear();
  load.mockReset().mockResolvedValue(empty);
});

it("shows honest zero and unrated states, with no invented engagement rate", async () => {
  render(<TutorDashboardStats />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading teaching overview");
  expect(await screen.findByText("Unrated")).toBeInTheDocument();
  expect(screen.getByText(/No reviews yet/)).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText("0.0 / 5")).not.toBeInTheDocument();
});

it("shows lesson status, engagement, published rating and written or rating-only reviews", async () => {
  load.mockResolvedValue({
    ...empty,
    classesThisWeek: 3,
    lessons: { completed: 7, confirmed: 4, pendingPayment: 2, cancelled: 1 },
    students: { total: 4, withCompletedLessons: 3, returning: 2, returningRate: 67 },
    reviews: {
      count: 12,
      averageRating: 4.7,
      recent: [
        {
          id: "r1",
          ratingStars: 5,
          text: "Clear and encouraging",
          createdAt: "2026-11-11T03:00:00Z",
          studentName: "Mali S.",
          subject: { id: "s1", name: "Math" },
        },
        {
          id: "r2",
          ratingStars: 4,
          text: null,
          createdAt: "2026-11-10T03:00:00Z",
          studentName: "Nok T.",
          subject: { id: "s2", name: "Physics" },
        },
      ],
    },
  });
  render(<TutorDashboardStats />);
  expect(await screen.findByText("4.7 / 5")).toBeInTheDocument();
  expect(screen.getByText("12 published reviews")).toBeInTheDocument();
  const status = screen.getByRole("region", { name: "Lesson status" });
  expect(within(status).getByText("4")).toBeInTheDocument();
  expect(within(status).getByText("7")).toBeInTheDocument();
  expect(screen.getByText("67%")).toBeInTheDocument();
  expect(screen.getByText("Clear and encouraging")).toBeInTheDocument();
  expect(screen.getByText("Rating only · no written comment")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View public profile" })).toHaveAttribute(
    "href",
    "/tutors/tutor-1"
  );
});

it("shows a recoverable load error instead of misleading zeros and can retry", async () => {
  load.mockRejectedValueOnce(new Error("Unable to load your statistics"));
  render(<TutorDashboardStats />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your statistics");
  expect(screen.queryByText("Unrated")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh overview" }));
  expect(await screen.findByText("Unrated")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});

it("lets the Tutor flag a comment, marks one already flagged, and skips rating-only reviews", async () => {
  localStorage.setItem("authToken", "tutor-token");
  const review = { createdAt: "2026-11-11T03:00:00Z", subject: { id: "s1", name: "Math" } };
  load.mockResolvedValue({
    ...empty,
    reviews: {
      count: 3,
      averageRating: 2,
      recent: [
        { ...review, id: "r1", ratingStars: 1, text: "Rude comment", studentName: "Mali S." },
        {
          ...review,
          id: "r2",
          ratingStars: 1,
          text: "Fake review",
          studentName: "Nok T.",
          flaggedByMe: true,
        },
        { ...review, id: "r3", ratingStars: 2, text: null, studentName: "Ann P." },
      ],
    },
  });
  render(<TutorDashboardStats />);

  expect(await screen.findByRole("button", { name: "Flag review by Mali S." })).toBeInTheDocument();
  expect(screen.getByText("Flagged")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Flag review by Nok T." })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Flag review by Ann P." })).not.toBeInTheDocument();
});
