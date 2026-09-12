import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StudentSettingsPage from "./page";

const fetchMock = jest.fn();
const learningAreaId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

// Renders with no logged-in session (skips the GET-prefill fetch, since it
// requires an authToken) and fills out every Student-preference section by hand.
async function completeSectionsFresh() {
  localStorage.setItem("authToken", "student-token");
  const searchInput = screen.getByLabelText("Search learning areas");
  fireEvent.focus(searchInput);
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
}

describe("StudentSettingsPage", () => {
  it("shows the settings sidebar with Student profile active", () => {
    render(<StudentSettingsPage />);

    const link = screen.getByRole("link", { name: "Student profile" });
    expect(link).toHaveAttribute("href", "/settings/student");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/settings/account"
    );
  });

  it("prefills learning preferences from the saved Student profile on mount", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        educationLevel: "UPPER_SECONDARY_SCHOOL",
        goals: ["EXAM_PREPARATION"],
        preferredLearningPeriod: "EVENING",
        preferredDurationMinutes: 60,
        learningAreas: [{ id: learningAreaId, name: "Mathematics" }],
      }),
    });

    render(<StudentSettingsPage />);

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByLabelText("Education level")).toHaveValue("UPPER_SECONDARY_SCHOOL");
    expect(screen.getByLabelText("Prepare for an examination")).toBeChecked();
    expect(screen.getByLabelText("Preferred learning period")).toHaveValue("EVENING");
    expect(screen.getByLabelText("Preferred lesson duration")).toHaveValue("60");
    expect(fetchMock).toHaveBeenCalledWith("/api/profiles/me/student", {
      headers: { Authorization: "Bearer student-token" },
      signal: expect.any(AbortSignal),
    });
  });

  it("leaves the form blank when onboarding has not been completed yet (404)", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    render(<StudentSettingsPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Education level")).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("blocks submission when required Student-preference sections are incomplete", () => {
    render(<StudentSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Please complete every section before saving your profile.")
    ).toBeInTheDocument();
  });

  it("requires login before sending the profile", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ id: learningAreaId, name: "Mathematics" }],
    });

    render(<StudentSettingsPage />);
    await completeSectionsFresh();
    localStorage.removeItem("authToken");

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/profiles/me/student",
      expect.objectContaining({ method: "PUT" })
    );
    expect(
      screen.getByText("Please log in before saving your Student profile.")
    ).toBeInTheDocument();
  });

  it("sends the Student-preference request body on save", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: learningAreaId, name: "Mathematics" }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<StudentSettingsPage />);
    await completeSectionsFresh();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profiles/me/student", {
      method: "PUT",
      headers: {
        Authorization: "Bearer student-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        educationLevel: "UPPER_SECONDARY_SCHOOL",
        learningAreaIds: [learningAreaId],
        goals: ["EXAM_PREPARATION"],
        preferredLearningPeriod: "EVENING",
        preferredDurationMinutes: 60,
      }),
    });
    expect(await screen.findByText("Student profile saved successfully.")).toBeInTheDocument();
  });
});
