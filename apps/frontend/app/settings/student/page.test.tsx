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
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
}

async function completeSections() {
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
  it("blocks saving and highlights the name fields when everything is empty", () => {
    render(<StudentSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("First name is required.")).toBeInTheDocument();
    expect(screen.getByText("Last name is required.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete the highlighted fields and finish every section before saving your profile."
      )
    ).toBeInTheDocument();
  });

  it("blocks submission when required sections are incomplete but the name is valid", () => {
    render(<StudentSettingsPage />);
    fillName();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("First name is required.")).not.toBeInTheDocument();
    expect(
      screen.getByText("Please complete every section before saving your profile.")
    ).toBeInTheDocument();
  });

  it("loads learning areas when the search field is focused", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ id: learningAreaId, name: "Mathematics" }],
    });

    render(<StudentSettingsPage />);
    fireEvent.focus(screen.getByLabelText("Search learning areas"));

    expect(await screen.findByRole("button", { name: "Mathematics" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/profiles/learning-areas", {
      headers: { Authorization: "Bearer student-token" },
      signal: expect.any(AbortSignal),
    });
  });

  it("requires login before sending the profile", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ id: learningAreaId, name: "Mathematics" }],
    });

    render(<StudentSettingsPage />);
    fillName();
    await completeSections();
    localStorage.removeItem("authToken");

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalledWith("/api/profiles/me/student", expect.anything());
    expect(
      screen.getByText("Please log in before saving your Student profile.")
    ).toBeInTheDocument();
  });

  it("sends the full request body with the Bearer token and shows the success message", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: learningAreaId, name: "Mathematics" }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<StudentSettingsPage />);
    fillName();
    await completeSections();

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
