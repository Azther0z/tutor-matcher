import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EnrollTutorPage from "./page";

const mockReplace = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/enroll-tutor",
  useRouter: () => ({ push: mockReplace, replace: mockReplace }),
}));

beforeEach(() => {
  mockReplace.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "test-token");
});

const pendingTutor = {
  id: "88888888-8888-4888-8888-888888888888",
  avatarUrl: null,
  bio: "I teach mathematics.",
  introVideoUrl: "https://example.com/intro.mp4",
  governmentId: "ID-123",
  certificationUrl: "https://example.com/certification.pdf",
  status: "PENDING",
  enrolledAt: "2026-01-01T00:00:00.000Z",
};

function mockApplication(body: unknown) {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
}

function completeRequiredFields() {
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "I teach mathematics." },
  });
  fireEvent.change(screen.getByLabelText("Intro video URL"), {
    target: { value: "https://example.com/intro.mp4" },
  });
  fireEvent.change(screen.getByLabelText(/Government ID/), { target: { value: "ID-123" } });
  fireEvent.change(screen.getByLabelText(/Teaching certification document URL/), {
    target: { value: "https://example.com/certification.pdf" },
  });
}

describe("EnrollTutorPage", () => {
  it("shows the application form for a new applicant", async () => {
    mockApplication({ status: "NONE", tutor: null });
    render(<EnrollTutorPage />);

    expect(
      await screen.findByRole("button", { name: "Submit application" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tutor bio")).toHaveValue("");
  });

  it("blocks submitting and highlights required fields when they are empty", async () => {
    mockApplication({ status: "NONE", tutor: null });
    render(<EnrollTutorPage />);
    await screen.findByRole("button", { name: "Submit application" });

    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial GET
    expect(screen.getByText("Tutor bio is required.")).toBeInTheDocument();
    expect(screen.getByText("Intro video URL is required.")).toBeInTheDocument();
    expect(screen.getByText("Government ID is required.")).toBeInTheDocument();
    expect(
      screen.getByText("A teaching certification document is required.")
    ).toBeInTheDocument();
  });

  it("submits the public Tutor details and then shows the awaiting-approval panel", async () => {
    mockApplication({ status: "NONE", tutor: null });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ tutor: pendingTutor }) });
    render(<EnrollTutorPage />);
    await screen.findByRole("button", { name: "Submit application" });

    completeRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/profiles/me/tutor", {
      method: "PUT",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        avatarUrl: null,
        bio: "I teach mathematics.",
        introVideoUrl: "https://example.com/intro.mp4",
        governmentId: "ID-123",
        certificationUrl: "https://example.com/certification.pdf",
      }),
    });
    expect(await screen.findByText("Awaiting approval")).toBeInTheDocument();
  });

  it("shows the awaiting-approval panel for a pending applicant and can reopen the form", async () => {
    mockApplication({ status: "PENDING", tutor: pendingTutor });
    render(<EnrollTutorPage />);

    expect(await screen.findByText("Awaiting approval")).toBeInTheDocument();
    expect(screen.getByText(pendingTutor.certificationUrl)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel & re-submit" }));

    expect(screen.getByRole("button", { name: "Submit application" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Government ID/)).toHaveValue("ID-123");
    expect(screen.getByLabelText(/Teaching certification document URL/)).toHaveValue(
      pendingTutor.certificationUrl
    );
  });

  it("redirects an approved Tutor to the Tutor dashboard", async () => {
    mockApplication({ status: "APPROVED", tutor: { ...pendingTutor, status: "PUBLISHED" } });
    render(<EnrollTutorPage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard/tutor"));
    expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument();
  });

  it("shows a rejection notice and lets a rejected applicant re-submit", async () => {
    mockApplication({ status: "REJECTED", tutor: { ...pendingTutor, status: "REJECTED" } });
    render(<EnrollTutorPage />);

    expect(
      await screen.findByText("Your previous application was not approved. Update your details and re-submit.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tutor bio")).toHaveValue("I teach mathematics.");
    expect(screen.getByLabelText(/Teaching certification document URL/)).toHaveValue(
      pendingTutor.certificationUrl
    );
  });

  it("shows an error when the application cannot be loaded", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<EnrollTutorPage />);

    expect(
      await screen.findByText("We could not load your Tutor application. Please refresh and try again.")
    ).toBeInTheDocument();
  });
});
