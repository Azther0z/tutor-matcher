import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StudentOnboardingPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

describe("StudentOnboardingPage", () => {
  it("loads all learning areas when the search field is focused", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, name: "Mathematics" }],
    });

    render(<StudentOnboardingPage />);
    fireEvent.focus(screen.getByLabelText("Search learning areas"));

    expect(await screen.findByRole("button", { name: "Mathematics" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/profiles/learning-areas", {
      headers: { Authorization: "Bearer student-token" },
      signal: expect.any(AbortSignal),
    });
  });

  it("closes learning-area suggestions when clicking outside", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, name: "Mathematics" }],
    });

    render(<StudentOnboardingPage />);
    fireEvent.focus(screen.getByLabelText("Search learning areas"));

    expect(await screen.findByRole("button", { name: "Mathematics" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("button", { name: "Mathematics" })).not.toBeInTheDocument();
  });

  it("blocks submission when required sections are incomplete", () => {
    localStorage.setItem("authToken", "student-token");
    render(<StudentOnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Please complete every section before continuing.")
    ).toBeInTheDocument();
  });

  it("searches, selects, and saves a complete Student profile", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, name: "Mathematics" }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<StudentOnboardingPage />);
    const searchInput = screen.getByLabelText("Search learning areas");
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, {
      target: { value: "math" },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Mathematics" }));
    fireEvent.change(screen.getByLabelText("Education level"), {
      target: { value: "UPPER_SECONDARY_SCHOOL" },
    });
    fireEvent.click(screen.getByLabelText("Prepare for an examination"));
    fireEvent.change(screen.getByLabelText("Preferred learning period"), {
      target: { value: "EVENING" },
    });
    fireEvent.change(screen.getByLabelText("Preferred lesson duration"), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profiles/me/student", {
      method: "PUT",
      headers: {
        Authorization: "Bearer student-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        educationLevel: "UPPER_SECONDARY_SCHOOL",
        learningAreaIds: [1],
        goals: ["EXAM_PREPARATION"],
        preferredLearningPeriod: "EVENING",
        preferredDurationMinutes: 60,
      }),
    });
  });
});
