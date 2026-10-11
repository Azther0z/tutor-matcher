import { openTutorEditor, confirmTutorSubmission } from "@/src/test/tutor-editor-helpers";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TutorSettingsPage from "./page";
import {
  approvedTutor,
  jsonApplicationResponse as jsonResponse,
  profileVersion,
} from "@/src/test/tutor-profile-fixtures";

const fetchMock = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/settings/tutor",
  useRouter: () => ({ replace: mockReplace }),
}));
beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "token");
});
const approved = {
  status: "APPROVED",
  tutor: approvedTutor,
  version: { ...profileVersion, status: "APPROVED" },
};
const approvedWithDraft = { ...approved, version: { ...profileVersion, status: "DRAFT" } };
const pendingEdit = {
  ...approved,
  version: { ...profileVersion, bio: "New bio awaiting review." },
};

it("loads saved draft fields, keeps account names separate, and requires changes", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(approvedWithDraft));
  render(<TutorSettingsPage />);
  await openTutorEditor();
  expect(await screen.findByLabelText("Tutor bio")).toHaveValue(approvedTutor.bio);
  expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "account settings" })).toHaveAttribute(
    "href",
    "/settings/account"
  );
  expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "A changed bio." } });
  expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
});

it("redirects students to enrollment rather than showing tutor editing controls", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ status: "PENDING", tutor: null, version: profileVersion })
  );
  render(<TutorSettingsPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/enroll-tutor"));
  expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
});

it("keeps the approved profile and publication controls while an edit is pending", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(pendingEdit));
  render(<TutorSettingsPage />);
  await screen.findByText("Pending Verification");
  const current = screen.getByRole("region", { name: "Current approved profile" });
  expect(within(current).getByText(approvedTutor.bio!)).toBeInTheDocument();
  expect(within(current).queryByText("New bio awaiting review.")).not.toBeInTheDocument();
  expect(within(current).getByText("Verified")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Unpublish profile" })).toBeEnabled();
  expect(screen.queryByLabelText("Tutor bio")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New draft" })).toBeEnabled();
  expect(screen.getByRole("link", { name: profileVersion.identificationCardUrl! })).toHaveAttribute(
    "href",
    profileVersion.identificationCardUrl
  );
  expect(screen.getByRole("link", { name: profileVersion.certificationUrl! })).toHaveAttribute(
    "href",
    profileVersion.certificationUrl
  );
});

it("shows every portfolio certificate in the owner's pending edit", async () => {
  const urls = [profileVersion.certificationUrl!, "https://example.com/extra-certificate.pdf"];
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ ...pendingEdit, version: { ...pendingEdit.version, certificationUrls: urls } })
  );
  render(<TutorSettingsPage />);
  const pending = await screen.findByRole("region", { name: "Submission history" });
  for (const url of urls) {
    expect(within(pending).getByRole("link", { name: url })).toHaveAttribute("href", url);
  }
});

it("edits all certificates and preserves them through bio-only saves", async () => {
  const extra = "https://example.com/extra.pdf";
  const tutor = { ...approvedTutor, certificationUrls: [profileVersion.certificationUrl!, extra] };
  const version = {
    ...profileVersion,
    status: "DRAFT",
    certificationUrls: tutor.certificationUrls,
    bio: "Updated bio.",
  };
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        ...approved,
        tutor,
        version: { ...profileVersion, ...tutor, id: profileVersion.id, status: "DRAFT" },
      })
    )
    .mockResolvedValueOnce(jsonResponse({ ...approved, tutor, version }));
  render(<TutorSettingsPage />);
  await openTutorEditor();
  expect(await screen.findByLabelText("Certification / portfolio URL 2")).toHaveValue(extra);
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Updated bio." } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(payload.bio).toBe("Updated bio.");
  expect(payload).not.toHaveProperty("certificationUrl");
  expect(payload.certificationUrls).toEqual(tutor.certificationUrls);
  expect(screen.getByLabelText("Certification / portfolio URL 2")).toHaveValue(extra);
});

it("retries a replacement with the same collection and adopts the saved ordering", async () => {
  const original = "https://example.com/a.pdf";
  const extra = "https://example.com/m.pdf";
  const replacement = "https://example.com/z.pdf";
  const tutor = { ...approvedTutor, certificationUrls: [original, extra] };
  const version = { ...profileVersion, status: "DRAFT", certificationUrls: [extra, replacement] };
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        ...approved,
        tutor,
        version: { ...profileVersion, ...tutor, id: profileVersion.id, status: "DRAFT" },
      })
    )
    .mockRejectedValueOnce(new Error("Response lost after saving"))
    .mockResolvedValueOnce(jsonResponse({ ...approved, tutor, version }))
    .mockResolvedValueOnce(jsonResponse({ ...approved, tutor, version }));
  render(<TutorSettingsPage />);
  await openTutorEditor();
  fireEvent.change(await screen.findByLabelText("Certification / portfolio URL 1"), {
    target: { value: replacement },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Response lost after saving");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).certificationUrls).toEqual([
    replacement,
    extra,
  ]);
  expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[1][1].body);
  expect(screen.getByLabelText("Certification / portfolio URL 1")).toHaveValue(extra);
  expect(screen.getByLabelText("Certification / portfolio URL 2")).toHaveValue(replacement);
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(fetchMock.mock.calls[3][0]).toBe(`/api/profiles/me/tutor/drafts/${profileVersion.id}`);
  expect(JSON.parse(fetchMock.mock.calls[3][1].body).certificationUrls).toEqual([
    extra,
    replacement,
  ]);
});

it("removes exactly one certificate and permits an empty saved draft", async () => {
  const extra = "https://example.com/extra.pdf";
  const tutor = { ...approvedTutor, certificationUrls: [profileVersion.certificationUrl!, extra] };
  const version = { ...profileVersion, status: "DRAFT", certificationUrls: [extra] };
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        ...approved,
        tutor,
        version: { ...profileVersion, ...tutor, id: profileVersion.id, status: "DRAFT" },
      })
    )
    .mockResolvedValueOnce(jsonResponse({ ...approved, tutor, version }))
    .mockResolvedValueOnce(
      jsonResponse({ ...approved, tutor, version: { ...version, certificationUrls: [] } })
    );
  render(<TutorSettingsPage />);
  await openTutorEditor();
  fireEvent.click(await screen.findByRole("button", { name: "Remove certification 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).certificationUrls).toEqual([extra]);
  fireEvent.click(screen.getByRole("button", { name: "Remove certification 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).certificationUrls).toEqual([]);
});

it("deduplicates replacement URLs on save and retry without resurrecting removed certificates", async () => {
  const original = "https://example.com/a.pdf";
  const retained = "https://example.com/b.pdf";
  const tutor = { ...approvedTutor, certificationUrls: [original, retained] };
  const version = { ...profileVersion, status: "DRAFT", certificationUrls: [retained] };
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        ...approved,
        tutor,
        version: { ...profileVersion, ...tutor, id: profileVersion.id, status: "DRAFT" },
      })
    )
    .mockRejectedValueOnce(new Error("Response lost after saving"))
    .mockResolvedValueOnce(jsonResponse({ ...approved, tutor, version }))
    .mockResolvedValueOnce(
      jsonResponse({ ...approved, tutor, version: { ...version, certificationUrls: [] } })
    );
  render(<TutorSettingsPage />);
  await openTutorEditor();
  fireEvent.change(await screen.findByLabelText("Certification / portfolio URL 1"), {
    target: { value: retained },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Response lost after saving");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).certificationUrls).toEqual([retained]);
  expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[1][1].body);
  fireEvent.click(screen.getByRole("button", { name: "Remove certification 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(JSON.parse(fetchMock.mock.calls[3][1].body).certificationUrls).toEqual([]);
});

it("allows submission when only an extra certificate differs from the approved collection", async () => {
  const primary = profileVersion.certificationUrl!;
  const currentExtra = "https://example.com/b-certificate.pdf";
  const proposedExtra = "https://example.com/z-certificate.pdf";
  const tutor = { ...approvedTutor, certificationUrls: [primary, currentExtra] };
  const version = {
    ...approved.version,
    status: "DRAFT",
    certificationUrls: [primary, proposedExtra],
  };
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ ...approved, tutor, version }))
    .mockResolvedValueOnce(jsonResponse({ ...approved, tutor, version }))
    .mockResolvedValueOnce(
      jsonResponse({ ...approved, tutor, version: { ...version, status: "PENDING" } })
    );
  render(<TutorSettingsPage />);
  await openTutorEditor();
  await screen.findByLabelText("Tutor bio");
  const submit = screen.getByRole("button", { name: "Submit" });
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await confirmTutorSubmission();
  await screen.findByText("Pending Verification");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).certificationUrls).toEqual([
    primary,
    proposedExtra,
  ]);
});

it("keeps submission disabled for reordered certificates even with a different singular selection", async () => {
  const primary = profileVersion.certificationUrl!;
  const extra = "https://example.com/extra-certificate.pdf";
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      ...approved,
      tutor: { ...approvedTutor, certificationUrls: [primary, extra] },
      version: {
        ...approved.version,
        status: "DRAFT",
        certificationUrl: extra,
        certificationUrls: [extra, primary],
      },
    })
  );
  render(<TutorSettingsPage />);
  await openTutorEditor();
  expect(await screen.findByLabelText("Certification / portfolio URL 1")).toHaveValue(extra);
  expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("submits edits without overwriting the live profile, names, or publication", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(approved))
    .mockResolvedValueOnce(
      jsonResponse({
        ...approved,
        version: { ...profileVersion, status: "DRAFT", bio: "New bio awaiting review." },
      })
    )
    .mockResolvedValueOnce(jsonResponse(pendingEdit));
  render(<TutorSettingsPage />);
  await openTutorEditor();
  fireEvent.change(await screen.findByLabelText("Tutor bio"), {
    target: { value: "New bio awaiting review." },
  });
  fireEvent.change(screen.getByLabelText("Intro video URL"), {
    target: { value: approvedTutor.introVideoUrl },
  });
  fireEvent.change(screen.getByLabelText(/Identification card URL/), {
    target: { value: approvedTutor.identificationCardUrl },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await confirmTutorSubmission();
  await screen.findByText("Pending Verification");
  expect(
    within(screen.getByRole("region", { name: "Current approved profile" })).getByText(
      approvedTutor.bio!
    )
  ).toBeInTheDocument();
  expect(screen.getByText("Published", { exact: true })).toBeInTheDocument();
  expect(fetchMock.mock.calls[1][0]).toBe("/api/profiles/me/tutor/drafts");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("user");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("status");
});

it("allows publishing independently of a pending review", async () => {
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({ ...pendingEdit, tutor: { ...approvedTutor, status: "UNPUBLISHED" } })
    )
    .mockResolvedValueOnce(jsonResponse(pendingEdit));
  render(<TutorSettingsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Publish profile" }));
  expect(await screen.findByText("Your profile is now published.")).toBeInTheDocument();
  expect(screen.getByText("Pending Verification")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Unpublish profile" })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/profiles/me/tutor/publication",
    expect.objectContaining({ method: "PATCH", body: JSON.stringify({ published: true }) })
  );
});

it("keeps rejected edits separate from the approved profile and displays the reason", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      ...approved,
      version: {
        ...profileVersion,
        status: "REJECTED",
        bio: "Rejected bio.",
        rejectionReason: "Clarify your qualifications.",
      },
    })
  );
  render(<TutorSettingsPage />);
  await openTutorEditor();
  expect(screen.getAllByText(/Clarify your qualifications/).length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("");
  expect(
    within(screen.getByRole("region", { name: "Current approved profile" })).getByText(
      approvedTutor.bio!
    )
  ).toBeInTheDocument();
  expect(screen.getByText("Published", { exact: true })).toBeInTheDocument();
});

it.each(["PUBLISHED", "UNPUBLISHED"])(
  "refreshing approval applies the new profile while preserving %s",
  async (publication) => {
    const tutor = { ...approvedTutor, status: publication };
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...pendingEdit, tutor })).mockResolvedValueOnce(
      jsonResponse({
        ...approved,
        tutor: { ...tutor, bio: "Approved updated bio." },
        version: { ...profileVersion, status: "APPROVED", bio: "Approved updated bio." },
      })
    );
    render(<TutorSettingsPage />);
    await screen.findByText("Pending Verification");
    fireEvent.click(screen.getByRole("button", { name: "Refresh review status" }));
    const current = await screen.findByRole("region", { name: "Current approved profile" });
    expect(await within(current).findByText("Approved updated bio.")).toBeInTheDocument();
    expect(
      screen.getByText(publication === "PUBLISHED" ? "Published" : "Unpublished", { exact: true })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/approved changes have been applied automatically/)
    ).toBeInTheDocument();
    expect(screen.queryByText("Pending Verification")).not.toBeInTheDocument();
  }
);

it("allows a bio edit while retaining approved HTTP document links", async () => {
  const profile = {
    ...approvedTutor,
    introVideoUrl: "http://example.com/intro.mp4",
    identificationCardUrl: "http://example.com/id.png",
    certificationUrl: "http://example.com/certificate.pdf",
    certificationUrls: ["http://example.com/certificate.pdf"],
  };
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      ...approved,
      tutor: profile,
      version: { ...profileVersion, ...profile, id: profileVersion.id, status: "DRAFT" },
    })
  );
  render(<TutorSettingsPage />);
  await openTutorEditor();
  await screen.findByLabelText("Tutor bio");
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "Updated experience." },
  });
  expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  expect(screen.getByLabelText(/Identification card URL/)).toHaveValue(
    profile.identificationCardUrl
  );
});
