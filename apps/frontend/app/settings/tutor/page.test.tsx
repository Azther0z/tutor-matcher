import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TutorSettingsPage from "./page";
import { approvedTutor, jsonResponse, profileVersion } from "@/src/test/tutor-profile-fixtures";

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
const pendingEdit = {
  ...approved,
  version: { ...profileVersion, bio: "New bio awaiting review." },
};

it("prefills approved fields, keeps account names separate, and requires changes", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(approved));
  render(<TutorSettingsPage />);
  expect(await screen.findByLabelText("Tutor bio")).toHaveValue(approvedTutor.bio);
  expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "account settings" })).toHaveAttribute(
    "href",
    "/settings/account"
  );
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Submit changes for review" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "A changed bio." } });
  expect(screen.getByRole("button", { name: "Submit changes for review" })).toBeEnabled();
});

it("redirects students to enrollment rather than showing tutor editing controls", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ status: "PENDING", tutor: null, version: profileVersion })
  );
  render(<TutorSettingsPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/enroll-tutor"));
  expect(
    screen.queryByRole("button", { name: "Submit changes for review" })
  ).not.toBeInTheDocument();
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
  expect(screen.getByRole("link", { name: profileVersion.identificationCardUrl! })).toHaveAttribute(
    "href",
    profileVersion.identificationCardUrl
  );
  expect(screen.getByRole("link", { name: profileVersion.certificationUrl! })).toHaveAttribute(
    "href",
    profileVersion.certificationUrl
  );
});

it("shows every private certificate in the owner's pending edit", async () => {
  const urls = [profileVersion.certificationUrl!, "https://example.com/extra-certificate.pdf"];
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ ...pendingEdit, version: { ...pendingEdit.version, certificationUrls: urls } })
  );
  render(<TutorSettingsPage />);
  const pending = await screen.findByRole("region", { name: "Pending request" });
  for (const url of urls) {
    expect(within(pending).getByRole("link", { name: url })).toHaveAttribute("href", url);
  }
});

it("explains and displays retained extra certificates during a bio-only draft save", async () => {
  const extra = "https://example.com/extra-certificate.pdf";
  const version = {
    ...approved.version,
    certificationUrls: [profileVersion.certificationUrl!, extra],
  };
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ ...approved, version }))
    .mockResolvedValueOnce(
      jsonResponse({ ...approved, version: { ...version, status: "DRAFT", bio: "Updated bio." } })
    );
  render(<TutorSettingsPage />);
  const retained = await screen.findByRole("region", {
    name: "Additional teaching certifications (private)",
  });
  expect(within(retained).getByRole("link", { name: extra })).toHaveAttribute("href", extra);
  expect(within(retained).getByText(/other certifications are retained/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Updated bio." } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(payload.bio).toBe("Updated bio.");
  expect(payload.certificationUrl).toBe(profileVersion.certificationUrl);
  expect(payload.certificationUrls).toEqual([profileVersion.certificationUrl, extra]);
  expect(screen.getByRole("link", { name: extra })).toHaveAttribute("href", extra);
});

it("retries a late-sorting certificate replacement with the same complete collection", async () => {
  const original = "https://example.com/a-certificate.pdf";
  const extra = "https://example.com/m-certificate.pdf";
  const replacement = "https://example.com/z-certificate.pdf";
  const version = {
    ...approved.version,
    certificationUrl: original,
    certificationUrls: [original, extra],
  };
  const saved = {
    ...approved,
    version: {
      ...version,
      status: "DRAFT",
      certificationUrl: extra,
      certificationUrls: [extra, replacement],
    },
  };
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ ...approved, version }))
    .mockRejectedValueOnce(new Error("Response lost after saving"))
    .mockResolvedValueOnce(jsonResponse(saved))
    .mockResolvedValueOnce(jsonResponse(saved));
  render(<TutorSettingsPage />);
  fireEvent.change(await screen.findByLabelText(/Teaching certification document URL/), {
    target: { value: replacement },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Response lost after saving");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  const firstPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
  const retryPayload = JSON.parse(fetchMock.mock.calls[2][1].body);
  expect(firstPayload.certificationUrls).toEqual([replacement, extra]);
  expect(retryPayload).toEqual(firstPayload);
  expect(screen.getByLabelText(/Teaching certification document URL/)).toHaveValue(extra);
  expect(screen.getByRole("link", { name: replacement })).toHaveAttribute("href", replacement);
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(JSON.parse(fetchMock.mock.calls[3][1].body).certificationUrls).toEqual([
    extra,
    replacement,
  ]);
});

it("clearing the editable certificate removes only that entry from the draft snapshot", async () => {
  const extra = "https://example.com/extra-certificate.pdf";
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        ...approved,
        version: {
          ...approved.version,
          certificationUrls: [profileVersion.certificationUrl!, extra],
        },
      })
    )
    .mockResolvedValueOnce(
      jsonResponse({
        ...approved,
        version: {
          ...approved.version,
          status: "DRAFT",
          certificationUrl: extra,
          certificationUrls: [extra],
        },
      })
    );
  render(<TutorSettingsPage />);
  fireEvent.change(await screen.findByLabelText(/Teaching certification document URL/), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(payload.certificationUrl).toBeNull();
  expect(payload.certificationUrls).toEqual([extra]);
});

it("deduplicates replacing A with retained B on save and retry, then clears only B", async () => {
  const original = "https://example.com/a-certificate.pdf";
  const retained = "https://example.com/b-certificate.pdf";
  const version = {
    ...approved.version,
    certificationUrl: original,
    certificationUrls: [original, retained],
  };
  const saved = {
    ...approved,
    version: {
      ...version,
      status: "DRAFT",
      certificationUrl: retained,
      certificationUrls: [retained],
    },
  };
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ ...approved, version }))
    .mockRejectedValueOnce(new Error("Response lost after saving"))
    .mockResolvedValueOnce(jsonResponse(saved))
    .mockResolvedValueOnce(
      jsonResponse({
        ...saved,
        version: { ...saved.version, certificationUrl: null, certificationUrls: [] },
      })
    );
  render(<TutorSettingsPage />);
  fireEvent.change(await screen.findByLabelText(/Teaching certification document URL/), {
    target: { value: retained },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Response lost after saving");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).certificationUrls).toEqual([retained]);
  expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[1][1].body);
  fireEvent.change(screen.getByLabelText(/Teaching certification document URL/), {
    target: { value: "" },
  });
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
  await screen.findByLabelText("Tutor bio");
  fireEvent.click(screen.getByRole("checkbox"));
  const submit = screen.getByRole("button", { name: "Submit changes for review" });
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
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
  expect(await screen.findByLabelText(/Teaching certification document URL/)).toHaveValue(extra);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Submit changes for review" })).toBeDisabled();
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
  fireEvent.change(await screen.findByLabelText("Tutor bio"), {
    target: { value: "New bio awaiting review." },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Submit changes for review" }));
  await screen.findByText("Pending Verification");
  expect(
    within(screen.getByRole("region", { name: "Current approved profile" })).getByText(
      approvedTutor.bio!
    )
  ).toBeInTheDocument();
  expect(screen.getByText("Published", { exact: true })).toBeInTheDocument();
  expect(fetchMock.mock.calls[1][0]).toBe("/api/profiles/me/tutor/draft");
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
  expect(await screen.findByText(/Clarify your qualifications/)).toBeInTheDocument();
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Rejected bio.");
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
  };
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      ...approved,
      tutor: profile,
      version: { ...profileVersion, ...profile, status: "APPROVED" },
    })
  );
  render(<TutorSettingsPage />);
  await screen.findByLabelText("Tutor bio");
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "Updated experience." },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Submit changes for review" })).toBeEnabled();
  expect(screen.getByLabelText(/Identification card URL/)).toHaveValue(
    profile.identificationCardUrl
  );
});
