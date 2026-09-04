import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TutorSettingsPage from "./page";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

function completeRequiredFields() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "I teach mathematics." },
  });
  fireEvent.change(screen.getByLabelText("Intro video URL"), {
    target: { value: "https://example.com/intro.mp4" },
  });
  fireEvent.change(screen.getByLabelText(/Government ID/), { target: { value: "ID-123" } });
}

describe("TutorSettingsPage", () => {
  it("blocks saving and highlights required fields when they are empty", () => {
    render(<TutorSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("First name is required.")).toBeInTheDocument();
    expect(screen.getByText("Last name is required.")).toBeInTheDocument();
    expect(screen.getByText("Tutor bio is required.")).toBeInTheDocument();
    expect(screen.getByText("Intro video URL is required.")).toBeInTheDocument();
    expect(screen.getByText("Government ID is required.")).toBeInTheDocument();
  });

  it("requires login before sending the profile", () => {
    render(<TutorSettingsPage />);
    completeRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Please log in before saving your Tutor profile.")).toBeInTheDocument();
  });

  it("sends the supported profile fields with the Bearer token", async () => {
    localStorage.setItem("authToken", "test-token");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<TutorSettingsPage />);
    completeRequiredFields();

    fireEvent.change(screen.getByLabelText(/Personal bio/), {
      target: { value: "Account biography" },
    });
    fireEvent.change(screen.getByLabelText(/Avatar URL/), {
      target: { value: "https://example.com/avatar.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith("/api/profiles/me", {
      method: "PUT",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: { firstName: "Ada", lastName: "Lovelace", bio: "Account biography" },
        tutor: {
          avatarUrl: "https://example.com/avatar.jpg",
          bio: "I teach mathematics.",
          introVideoUrl: "https://example.com/intro.mp4",
          governmentId: "ID-123",
        },
      }),
    });
    expect(await screen.findByText("Tutor profile saved successfully.")).toBeInTheDocument();
  });
});
