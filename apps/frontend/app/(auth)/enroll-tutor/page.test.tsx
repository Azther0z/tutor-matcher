import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import EnrollTutorPage from "./page";
import {
  approvedTutor,
  jsonResponse,
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
  fireEvent.change(screen.getByLabelText(/Teaching certification document URL/), {
    target: { value: "example.com/certificate.pdf" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
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
  expect(await screen.findByRole("button", { name: "Submit application" })).toBeInTheDocument();
});

it("disables submission until required details and consent are valid", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(none));
  render(<EnrollTutorPage />);
  const submit = await screen.findByRole("button", { name: "Submit application" });
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
  fireEvent.click(screen.getByRole("checkbox"));
  expect(submit).toBeDisabled();
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
        certificationUrl: null,
        certificationUrls: [],
      },
    })
  );
  render(<EnrollTutorPage />);
  await screen.findByRole("button", { name: "Save draft" });
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Work in progress" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/profiles/me/tutor/draft",
    expect.objectContaining({
      method: "PUT",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        avatarUrl: null,
        bio: "Work in progress",
        introVideoUrl: null,
        identificationCardUrl: null,
        certificationUrl: null,
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
  await screen.findByRole("button", { name: "Submit application" });
  fillApplication();
  fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
  expect(await screen.findByText("Pending Verification")).toBeInTheDocument();
  expect(screen.getByText(/You remain a student until it is approved/)).toBeInTheDocument();
  expect(fetchMock.mock.calls[1]).toEqual([
    "/api/profiles/me/tutor/draft",
    expect.objectContaining({
      body: JSON.stringify({
        ...profileFields,
        certificationUrls: [profileFields.certificationUrl],
      }),
    }),
  ]);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/profiles/me/tutor/submit",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ consentAccepted: true }) })
  );
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Publish profile" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Tutor bio")).not.toBeInTheDocument();
});

it("requires successful server withdrawal before editing and supports resubmission", async () => {
  const cancelled = {
    ...pending,
    status: "CANCELLED",
    version: { ...profileVersion, status: "CANCELLED" },
  };
  fetchMock
    .mockResolvedValueOnce(jsonResponse(pending))
    .mockResolvedValueOnce(jsonResponse(cancelled))
    .mockResolvedValueOnce(
      jsonResponse({
        ...cancelled,
        status: "DRAFT",
        version: { ...profileVersion, status: "DRAFT" },
      })
    )
    .mockResolvedValueOnce(jsonResponse(pending));
  render(<EnrollTutorPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Withdraw request" }));
  expect(await screen.findByLabelText("Tutor bio")).toHaveValue(profileFields.bio);
  expect(fetchMock.mock.calls[1]).toEqual([
    "/api/profiles/me/tutor/withdraw",
    expect.objectContaining({ method: "POST" }),
  ]);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
  expect(await screen.findByText("Pending Verification")).toBeInTheDocument();
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
});

it("shows all private certificates in a pending application without a Tutor", async () => {
  const urls = [profileVersion.certificationUrl!, "https://example.com/extra-certificate.pdf"];
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ ...pending, version: { ...profileVersion, certificationUrls: urls } })
  );
  render(<EnrollTutorPage />);
  await screen.findByText("Pending Verification");
  for (const url of urls) {
    expect(screen.getByRole("link", { name: url })).toHaveAttribute("href", url);
  }
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
          rejectionReason: "Please provide a readable certificate.",
        },
      })
    )
    .mockResolvedValueOnce(
      jsonResponse({ ...pending, status: "DRAFT", version: { ...profileVersion, status: "DRAFT" } })
    )
    .mockResolvedValueOnce(jsonResponse(pending));
  render(<EnrollTutorPage />);
  expect(await screen.findByText(/Please provide a readable certificate/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Teaching certification document URL/), {
    target: { value: "https://example.com/readable.pdf" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
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
  await screen.findByRole("button", { name: "Submit application" });
  fillApplication();
  fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
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
  expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument();
});

it("retains accessible consent policy documents", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(none));
  render(<EnrollTutorPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Privacy Policy" }));
  expect(screen.getByRole("dialog", { name: "Privacy Policy" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close document" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("shows load errors and retries", async () => {
  fetchMock
    .mockRejectedValueOnce(new Error("Server unavailable"))
    .mockResolvedValueOnce(jsonResponse(none));
  render(<EnrollTutorPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("button", { name: "Submit application" })).toBeInTheDocument();
});
