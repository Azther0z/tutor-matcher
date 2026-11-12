import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("../../src/components/tutor-availability-editor", () => ({
  TutorAvailabilityEditor: () => <div>Availability editor</div>,
}));
jest.mock("../../src/components/tutor-needs-confirmation", () => ({
  TutorNeedsConfirmation: () => <div>Lessons needing confirmation</div>,
}));
jest.mock("../../src/components/tutor-upcoming-classes", () => ({
  TutorUpcomingClasses: () => <div>Upcoming lessons</div>,
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: mockPush, replace: mockPush }),
}));

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  window.history.replaceState({}, "", "/dashboard");
});

describe("DashboardPage", () => {
  it.each([404, 200])(
    "never requests teaching statistics for Students or pending applicants (%s)",
    async (tutorStatus) => {
      localStorage.setItem("authToken", "student-token");
      window.history.replaceState({}, "", "/dashboard?tab=tutor");
      fetchMock.mockImplementation(async (url: string) => ({
        ok: true,
        status: url.includes("/tutor") ? tutorStatus : 200,
        json: async () => ({ status: "PENDING" }),
      }));
      render(<DashboardPage />);
      await screen.findByText("Your Student profile is ready");
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/profiles/me/tutor", expect.any(Object))
      );
      expect(screen.queryByRole("tab", { name: "Tutor" })).not.toBeInTheDocument();
      expect(screen.queryByText("Teaching overview")).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([url]) => url === "/api/dashboard/tutor")).toBe(false);
      window.history.replaceState({}, "", "/dashboard");
    }
  );

  it("loads teaching statistics only when an approved Tutor opens the Tutor tab", async () => {
    localStorage.setItem("authToken", "tutor-token");
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url === "/api/dashboard/tutor"
          ? {
              tutorId: "tutor-1",
              classesThisWeek: 0,
              week: { start: "2026-11-08T17:00:00Z", end: "2026-11-15T17:00:00Z" },
              lessons: { completed: 0, confirmed: 0, pendingPayment: 0, cancelled: 0 },
              students: { total: 0, withCompletedLessons: 0, returning: 0, returningRate: null },
              reviews: { count: 0, averageRating: null, recent: [] },
            }
          : { status: "APPROVED" },
    }));
    render(<DashboardPage />);
    const tutorTab = await screen.findByRole("tab", { name: "Tutor" });
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/dashboard/tutor")).toBe(false);
    fireEvent.click(tutorTab);
    expect(await screen.findByText("Unrated")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Teaching overview" })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard/tutor",
      expect.objectContaining({
        headers: { Authorization: "Bearer tutor-token" },
      })
    );
    fireEvent.click(screen.getByRole("tab", { name: "Student" }));
    expect(screen.queryByRole("region", { name: "Teaching overview" })).not.toBeInTheDocument();
  });

  it("shows the onboarding prompt when the Student profile is missing", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValue({ status: 404, ok: false });

    render(<DashboardPage />);

    expect(await screen.findByText("Complete your Student profile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up your profile" })).toHaveAttribute(
      "href",
      "/settings/student"
    );
  });

  it("does not show the onboarding prompt when the Student profile exists", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValue({ status: 200, ok: true });

    render(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText("Your Student profile is ready")).toBeInTheDocument()
    );
    expect(screen.queryByText("Complete your Student profile")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit your profile" })).toHaveAttribute(
      "href",
      "/settings/account"
    );
  });
});
