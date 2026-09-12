import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StudentSettingsPage from "./page";

const fetchMock = jest.fn();
const learningAreaId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

function fillName() {
  fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Lovelace" } });
}

// Renders with no logged-in session (skips the GET-prefill fetch, since it
// requires an authToken) and fills out every section, including name, by hand.
async function completeSectionsFresh() {
  localStorage.setItem("authToken", "student-token");
  fillName();
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
  it("prefills name and learning preferences from the saved Student profile on mount", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        firstName: "Ada",
        lastName: "Lovelace",
        educationLevel: "UPPER_SECONDARY_SCHOOL",
        goals: ["EXAM_PREPARATION"],
        preferredLearningPeriod: "EVENING",
        preferredDurationMinutes: 60,
        learningAreas: [{ id: learningAreaId, name: "Mathematics" }],
      }),
    });

    render(<StudentSettingsPage />);

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue("Ada");
    expect(screen.getByLabelText(/Last name/)).toHaveValue("Lovelace");
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
    expect(screen.getByLabelText(/First name/)).toHaveValue("");
    expect(screen.getByLabelText(/Last name/)).toHaveValue("");
    expect(screen.getByLabelText("Education level")).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("blocks saving and shows a combined message when name is half-filled and sections are incomplete", () => {
    render(<StudentSettingsPage />);

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Last name is required.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete the highlighted fields and finish every section before saving your profile."
      )
    ).toBeInTheDocument();
  });

  it("blocks submission and shows a combined message when name is left blank and sections are incomplete", () => {
    render(<StudentSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("First name is required.")).toBeInTheDocument();
    expect(screen.getByText("Last name is required.")).toBeInTheDocument();
    // Name and sections are both invalid at this point, so the combined
    // message wins over the sections-only one.
    expect(
      screen.getByText(
        "Complete the highlighted fields and finish every section before saving your profile."
      )
    ).toBeInTheDocument();
  });

  it("blocks submission when required sections are incomplete but name is filled in", () => {
    render(<StudentSettingsPage />);

    fillName();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("First name is required.")).not.toBeInTheDocument();
    expect(screen.queryByText("Last name is required.")).not.toBeInTheDocument();
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

  it("sends the full request body, including the user key, on save", async () => {
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
        user: { firstName: "Ada", lastName: "Lovelace" },
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
