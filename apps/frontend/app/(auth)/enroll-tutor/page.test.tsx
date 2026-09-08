import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnrollTutorForm } from "./page";

const fetchMock = jest.fn();
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  fetchMock.mockReset();
  mockPush.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

function completeRequiredFields() {
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "I teach mathematics." },
  });
  fireEvent.change(screen.getByLabelText("Intro video URL"), {
    target: { value: "https://example.com/intro.mp4" },
  });
  fireEvent.change(screen.getByLabelText(/Government ID/), { target: { value: "ID-123" } });
}

describe("EnrollTutorForm", () => {
  it("blocks saving and highlights required fields when they are empty", () => {
    render(<EnrollTutorForm />);

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Tutor bio is required.")).toBeInTheDocument();
    expect(screen.getByText("Intro video URL is required.")).toBeInTheDocument();
    expect(screen.getByText("Government ID is required.")).toBeInTheDocument();
  });

  it("does not collect personal details", () => {
    render(<EnrollTutorForm />);

    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Last name")).not.toBeInTheDocument();
    expect(screen.queryByText("Personal details")).not.toBeInTheDocument();
  });

  it("requires login before sending the profile", () => {
    render(<EnrollTutorForm />);
    completeRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Please log in before saving your Tutor profile.")).toBeInTheDocument();
  });

  it("sends only the tutor fields with the Bearer token", async () => {
    localStorage.setItem("authToken", "test-token");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<EnrollTutorForm />);
    completeRequiredFields();

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
        tutor: {
          avatarUrl: "https://example.com/avatar.jpg",
          bio: "I teach mathematics.",
          introVideoUrl: "https://example.com/intro.mp4",
          governmentId: "ID-123",
        },
      }),
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/tutor"));
  });
});
