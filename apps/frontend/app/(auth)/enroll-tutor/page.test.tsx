import { openTutorEditor, confirmTutorSubmission } from "@/src/test/tutor-editor-helpers";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import EnrollTutorPage from "./page";
import {
  approvedTutor,
  jsonApplicationResponse as jsonResponse,
  profileFields,
  profileVersion,
} from "@/src/test/tutor-profile-fixtures";

const mockReplace = jest.fn();
const fetchMock = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/enroll-tutor",
  useRouter: () => ({ replace: mockReplace }),
}));
beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "test-token");
});

function fillApplication() {
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: profileFields.bio } });
  fireEvent.change(screen.getByLabelText("Intro video URL"), {
    target: { value: "example.com/intro.mp4" },
  });
  fireEvent.change(screen.getByLabelText(/Identification card URL/), {
    target: { value: "example.com/id.pdf" },
  });
}
const none = { status: "NONE", tutor: null, version: null };
const pending = { status: "PENDING", tutor: null, version: profileVersion };

it("redirects unauthenticated applicants without fetching", async () => {
  localStorage.clear();
  render(<EnrollTutorPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fenroll-tutor"));
  expect(fetchMock).not.toHaveBeenCalled();
});

it("loads the form under Strict Mode without getting stuck loading", async () => {
  fetchMock.mockResolvedValue(jsonResponse(none));
  render(
    <StrictMode>
      <EnrollTutorPage />
    </StrictMode>
  );
  await openTutorEditor();
  expect(await screen.findByRole("button", { name: "Submit" })).toBeInTheDocument();
});

it("validates details before confirmation and requires explicit consent before submitting", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(none));
  render(<EnrollTutorPage />);
  await openTutorEditor();
  const submit = screen.getByRole("button", { name: "Submit" });
  expect(submit).toBeDisabled();
  fillApplication();
  expect(submit).toBeEnabled();
  fireEvent.change(screen.getByLabelText(/Identification card URL/), {
    target: { value: "javascript:alert(1)" },
  });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Identification card URL/), {
    target: { value: "https://example.com/id.pdf" },
  });
  fireEvent.click(submit);
  const confirm = screen.getByRole("button", { name: "Confirm submit" });
  expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(confirm).toBeEnabled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(confirm).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("saves an incomplete draft without requiring consent or submitting", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(none)).mockResolvedValueOnce(
    jsonResponse({
      status: "DRAFT",
      tutor: null,
      version: {
        ...profileVersion,
        status: "DRAFT",
        bio: "Work in progress",
        introVideoUrl: null,
        identificationCardUrl: null,
        certificationUrls: [],
      },
    })
  );
  render(<EnrollTutorPage />);
  await openTutorEditor();
  await screen.findByRole("button", { name: "Save draft" });
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Work in progress" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/profiles/me/tutor/drafts",
    expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        avatarUrl: null,
        bio: "Work in progress",
        introVideoUrl: null,
        identificationCardUrl: null,
        certificationUrls: [],
      }),
    })
  );
  expect(screen.queryByText("Pending Verification")).not.toBeInTheDocument();
});

it("submits a normalized draft and remains pending with no Tutor or dashboard redirect", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(none))
    .mockResolvedValueOnce(
      jsonResponse({
        status: "DRAFT",
        tutor: null,
        version: { ...profileVersion, status: "DRAFT" },
      })
    )
    .mockResolvedValueOnce(jsonResponse(pending));
  render(<EnrollTutorPage />);
  await openTutorEditor();
  await screen.findByRole("button", { name: "Submit" });
  fillApplication();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await confirmTutorSubmission();
  expect(await screen.findByText("Pending Verification")).toBeInTheDocument();
  expect(screen.getByText(/You remain a student until it is approved/)).toBeInTheDocument();
  expect(fetchMock.mock.calls[1]).toEqual([
    "/api/profiles/me/tutor/drafts",
    expect.objectContaining({
      body: JSON.stringify({
        avatarUrl: null,
        bio: profileFields.bio,
        introVideoUrl: profileFields.introVideoUrl,
        identificationCardUrl: profileFields.identificationCardUrl,
        certificationUrls: [],
      }),
    }),
  ]);
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/profiles/me/tutor/drafts/${profileVersion.id}/submit`,
    expect.objectContaining({ method: "POST", body: JSON.stringify({ consentAccepted: true }) })
  );
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Publish profile" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Tutor bio")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New draft" })).toBeEnabled();
});

it("cancels a submission without creating a draft, then explicitly copies a new draft", async () => {
  const submission = { ...profileVersion, status: "CANCELLED" };
  const cancelled = { status: "CANCELLED", tutor: null, version: submission };
  const copied = {
    ...cancelled,
    status: "DRAFT",
    version: { ...profileVersion, id: "new-draft", status: "DRAFT" },
    submissions: [submission],
  };
  fetchMock
    .mockResolvedValueOnce(jsonResponse(pending))
    .mockResolvedValueOnce(jsonResponse(cancelled))
    .mockResolvedValueOnce(jsonResponse(copied));
  render(<EnrollTutorPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Withdraw request" }));
  await screen.findByText(
    "Request cancelled. You can create a new draft from its submission history."
  );
  expect(screen.getByText("No saved drafts yet.")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create draft from cancelled submission" }));
  expect(await screen.findByLabelText("Tutor bio")).toHaveValue(profileFields.bio);
  expect(fetchMock.mock.calls[2]).toEqual([
    `/api/profiles/me/tutor/submissions/${profileVersion.id}/copy`,
    expect.objectContaining({ method: "POST" }),
  ]);
  expect(screen.getByLabelText("Draft status")).toHaveTextContent("Saved");
});

it("keeps a pending request locked if withdrawal fails", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(pending))
    .mockResolvedValueOnce(
      jsonResponse({ message: "Already reviewed. Refresh your status." }, 409)
    );
  render(<EnrollTutorPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Withdraw request" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Already reviewed");
  expect(screen.queryByLabelText("Tutor bio")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New draft" })).toBeEnabled();
});

it("shows the rejection reason and lets the applicant revise and resubmit", async () => {
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        status: "REJECTED",
        tutor: null,
        version: {
          ...profileVersion,
          status: "REJECTED",
          rejectionReason: "Please provide a readable identification card.",
        },
      })
    )
    .mockResolvedValueOnce(
      jsonResponse({ ...pending, status: "DRAFT", version: { ...profileVersion, status: "DRAFT" } })
    )
    .mockResolvedValueOnce(jsonResponse(pending));
  render(<EnrollTutorPage />);
  await openTutorEditor();
  expect(
    screen.getAllByText(/Please provide a readable identification card/).length
  ).toBeGreaterThan(0);
  fillApplication();
  fireEvent.change(screen.getByLabelText(/Identification card URL/), {
    target: { value: "https://example.com/readable.pdf" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await confirmTutorSubmission();
  expect(await screen.findByText("Pending Verification")).toBeInTheDocument();
  expect(fetchMock.mock.calls[1][1].body).toContain("https://example.com/readable.pdf");
});

it("keeps the draft available when submission fails after saving", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(none))
    .mockResolvedValueOnce(
      jsonResponse({ ...pending, status: "DRAFT", version: { ...profileVersion, status: "DRAFT" } })
    )
    .mockResolvedValueOnce(jsonResponse({ message: "Please try again." }, 500));
  render(<EnrollTutorPage />);
  await openTutorEditor();
  await screen.findByRole("button", { name: "Submit" });
  fillApplication();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await confirmTutorSubmission();
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
  fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue(profileFields.bio);
});

it("refreshes a pending application to approval without auto-publishing", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(pending)).mockResolvedValueOnce(
    jsonResponse({
      status: "APPROVED",
      tutor: { ...approvedTutor, status: "UNPUBLISHED" },
      version: { ...profileVersion, status: "APPROVED" },
    })
  );
  render(<EnrollTutorPage />);
  await screen.findByText("Pending Verification");
  fireEvent.click(screen.getByRole("button", { name: "Refresh review status" }));
  expect(await screen.findByText("Verified")).toBeInTheDocument();
  expect(screen.getByText("Unpublished", { exact: true })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Manage your Tutor profile" })).toHaveAttribute(
    "href",
    "/settings/tutor"
  );
  expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
});

it("retains accessible consent policy documents", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(none));
  render(<EnrollTutorPage />);
  await openTutorEditor();
  fillApplication();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  fireEvent.click(await screen.findByRole("button", { name: "Privacy Policy" }));
  expect(screen.getByRole("dialog", { name: "Privacy Policy" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close Privacy Policy" }));
  expect(screen.queryByRole("dialog", { name: "Privacy Policy" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Draft" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Submit draft for review?" })).toBeInTheDocument();
});

it("shows load errors and retries", async () => {
  fetchMock
    .mockRejectedValueOnce(new Error("Server unavailable"))
    .mockResolvedValueOnce(jsonResponse(none));
  render(<EnrollTutorPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await openTutorEditor();
  expect(await screen.findByRole("button", { name: "Submit" })).toBeInTheDocument();
});
