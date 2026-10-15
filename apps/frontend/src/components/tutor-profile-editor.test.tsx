import { openTutorEditor, confirmTutorSubmission } from "@/src/test/tutor-editor-helpers";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TutorProfileEditor } from "./tutor-profile-editor";
import type { TutorApplicationResponse, TutorProfileVersion } from "@/src/lib/tutor-application";
import { approvedTutor, jsonResponse, profileVersion } from "@/src/test/tutor-profile-fixtures";

const fetchMock = jest.fn();
const replaceMock = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/enroll-tutor",
  useRouter: () => ({ replace: replaceMock }),
}));
const first: TutorProfileVersion = {
  ...profileVersion,
  id: "11111111-1111-4111-8111-111111111111",
  status: "DRAFT",
  bio: "First saved draft",
  certificationUrls: ["http://example.com/first.pdf", "https://example.com/extra.pdf"],
};
const second: TutorProfileVersion = {
  ...first,
  id: "22222222-2222-4222-8222-222222222222",
  bio: "Second saved draft",
  createdAt: "2026-10-11T11:00:00.000Z",
  certificationUrls: ["https://example.com/second.pdf"],
};
function application(overrides: Partial<TutorApplicationResponse> = {}): TutorApplicationResponse {
  return {
    status: "DRAFT",
    tutor: null,
    version: first,
    drafts: [first, second],
    submissions: overrides.pendingRequest ? [overrides.pendingRequest] : [],
    pendingRequest: null,
    latestReview: null,
    latestSubmittedVersion: null,
    ...overrides,
  };
}
beforeEach(() => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  fetchMock.mockReset();
  replaceMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "token");
});
afterEach(() => jest.restoreAllMocks());

it("lists saved dates and selects the exact snapshot, saving only its ID", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application())).mockResolvedValueOnce(
    jsonResponse(
      application({
        version: { ...second, bio: "Second revised" },
        drafts: [first, { ...second, bio: "Second revised" }],
      })
    )
  );
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  expect(await screen.findByLabelText("Tutor bio")).toHaveValue(first.bio);
  expect(
    screen.getByRole("region", { name: "Saved drafts" }).querySelectorAll("time")
  ).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /Edit draft .*Second saved draft/ }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue(second.bio);
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Second revised" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/profiles/me/tutor/drafts/${second.id}`);
  expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).bio).toBe("Second revised");
});

it("saves current edits before submitting the selected draft ID", async () => {
  const saved = { ...second, bio: "Latest local changes" };
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse(application({ version: saved, drafts: [first, saved] })))
    .mockResolvedValueOnce(
      jsonResponse(
        application({
          status: "PENDING",
          version: { ...saved, status: "PENDING" },
          drafts: [first],
          pendingRequest: { ...saved, status: "PENDING" },
        })
      )
    );
  render(<TutorProfileEditor enrollment />);
  fireEvent.click(await screen.findByRole("button", { name: /Edit draft .*Second saved draft/ }));
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: saved.bio } });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await confirmTutorSubmission();
  await screen.findByText("Pending Verification");
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/profiles/me/tutor/drafts/${second.id}`);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).bio).toBe(saved.bio);
  expect(fetchMock.mock.calls[2][0]).toBe(`/api/profiles/me/tutor/drafts/${second.id}/submit`);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ consentAccepted: true });
  expect(
    screen.getByRole("button", { name: /Edit draft .*First saved draft/ })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Edit draft .*Latest local changes/ })
  ).not.toBeInTheDocument();
});

it("deletes the selected persisted draft from its row only", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse(application({ version: first, drafts: [first] })));
  render(<TutorProfileEditor enrollment />);
  fireEvent.click(await screen.findByRole("button", { name: "Trash draft 2: Second saved draft" }));
  await screen.findByText("Draft discarded.");
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/profiles/me/tutor/drafts/${second.id}`);
  expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  expect(
    screen.queryByRole("button", { name: /Edit draft .*Second saved draft/ })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Edit draft .*First saved draft/ })
  ).toBeInTheDocument();
});

it("retains the saved draft when row deletion fails", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse({ message: "Draft is no longer editable" }, 409));
  render(<TutorProfileEditor enrollment />);
  fireEvent.click(await screen.findByRole("button", { name: "Trash draft 1: First saved draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Draft is no longer editable");
  fireEvent.click(screen.getByRole("button", { name: "Edit draft 1: First saved draft" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue(first.bio);
});

it("collects no certifications and clears any the draft inherited when saving", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  await screen.findByLabelText("Tutor bio");
  expect(
    screen.queryByRole("region", { name: "Teaching certifications / portfolio" })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add certification" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  // The first draft came back from the API with two certificates.
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).certificationUrls).toEqual([]);
});

it("blocks only submission while another request is pending, allowing draft edits and save", async () => {
  const data = application({
    status: "PENDING",
    version: profileVersion,
    pendingRequest: profileVersion,
  });
  fetchMock.mockResolvedValueOnce(jsonResponse(data)).mockResolvedValueOnce(
    jsonResponse({
      ...data,
      version: { ...second, bio: "Saved while pending" },
      drafts: [first, { ...second, bio: "Saved while pending" }],
    })
  );
  render(<TutorProfileEditor enrollment />);
  await screen.findByText("Pending Verification");
  fireEvent.click(screen.getByRole("button", { name: /Edit draft .*Second saved draft/ }));
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "Saved while pending" },
  });
  const submit = screen.getByRole("button", { name: "Submit" });
  expect(submit).toBeDisabled();
  fireEvent.submit(document.getElementById("tutor-draft-form")!);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText("Draft saved. It has not been submitted for review.");
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Saved while pending");
  const pending = screen.getByRole("region", { name: "Submission history" });
  expect(within(pending).getByText("Pending Verification").closest("details")).not.toHaveAttribute(
    "open"
  );
  expect(screen.queryByRole("region", { name: "Pending request" })).not.toBeInTheDocument();
  expect(within(pending).getByRole("button", { name: "Withdraw request" })).toBeEnabled();
  expect(within(pending).getByText(profileVersion.bio!)).toBeInTheDocument();
  expect(within(pending).queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New draft" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Trash draft 2: Saved while pending" })).toBeEnabled();
});

it("can create and delete another draft while pending without changing the request", async () => {
  const data = application({
    status: "PENDING",
    version: profileVersion,
    pendingRequest: profileVersion,
  });
  fetchMock
    .mockResolvedValueOnce(jsonResponse(data))
    .mockResolvedValueOnce(jsonResponse({ ...data, version: second, drafts: [first, second] }))
    .mockResolvedValueOnce(jsonResponse({ ...data, drafts: [first] }));
  render(<TutorProfileEditor enrollment />);
  fireEvent.click(await screen.findByRole("button", { name: "New draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText("Draft saved. It has not been submitted for review.");
  expect(fetchMock.mock.calls[1][0]).toBe("/api/profiles/me/tutor/drafts");
  expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  fireEvent.click(screen.getByRole("button", { name: "Close Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Trash draft 2: Second saved draft" }));
  await screen.findByText("Draft discarded.");
  expect(fetchMock.mock.calls[2][0]).toBe(`/api/profiles/me/tutor/drafts/${second.id}`);
  expect(screen.getByText("Pending Verification")).toBeInTheDocument();
});

it("guards draft switches and starting another form with Save, Discard, and close", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Keep me" } });
  fireEvent.click(screen.getByRole("button", { name: /Edit draft .*Second saved draft/ }));
  expect(screen.getByRole("dialog", { name: "Unsaved changes" })).toBeInTheDocument();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.queryByLabelText("Tutor bio")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close Unsaved changes" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Keep me");
  fireEvent.click(screen.getByRole("button", { name: "New draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Close Unsaved changes" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Keep me");
  fireEvent.click(screen.getByRole("button", { name: /Edit draft .*Second saved draft/ }));
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue(second.bio);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("drops an unsaved new form through the close prompt without issuing DELETE", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse(application({ status: "NONE", version: null, drafts: [] }))
  );
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Unsaved" } });
  fireEvent.click(screen.getByRole("button", { name: "Close Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await openTutorEditor();
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("shows the latest rejection independently of saved drafts and pending status", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse(
      application({
        latestReview: {
          ...profileVersion,
          status: "REJECTED",
          rejectionReason: "Unreadable documents",
        },
        pendingRequest: profileVersion,
      })
    )
  );
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  expect(await screen.findByText(/Unreadable documents/)).toBeInTheDocument();
  expect(screen.getByLabelText("Tutor bio")).toHaveValue(first.bio);
  expect(screen.getByText("Pending Verification")).toBeInTheDocument();
});

it("starts new Tutor drafts empty even with approved and rejected profiles", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse(
      application({
        status: "APPROVED",
        tutor: approvedTutor,
        latestReview: { ...second, status: "REJECTED" },
      })
    )
  );
  render(<TutorProfileEditor />);
  fireEvent.click(await screen.findByRole("button", { name: "New draft" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("");
});

it("uses contrasting primary hover styles without secondary hover backgrounds", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  const submit = await screen.findByRole("button", { name: "Submit" });
  expect(submit).toHaveClass("bg-foreground", "text-background", "hover:opacity-80");
  expect(submit).not.toHaveClass("hover:bg-black/[.04]", "dark:hover:bg-white/[.08]");
  expect(screen.getByRole("button", { name: "Save draft" })).toHaveClass("hover:bg-black/[.04]");
});

it("starts a new applicant draft empty without changing saved drafts", async () => {
  const rejected = { ...second, status: "REJECTED" as const, bio: "Latest rejected snapshot" };
  fetchMock.mockResolvedValueOnce(jsonResponse(application({ latestReview: rejected })));
  render(<TutorProfileEditor enrollment />);
  fireEvent.click(await screen.findByRole("button", { name: "New draft" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("");
  expect(
    screen.getByRole("button", { name: /Edit draft .*First saved draft/ })
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("retains an edited draft when withdrawal changes the separate pending request", async () => {
  const data = application({ pendingRequest: profileVersion });
  fetchMock.mockResolvedValueOnce(jsonResponse(data)).mockResolvedValueOnce(
    jsonResponse({
      ...data,
      pendingRequest: null,
      submissions: [{ ...profileVersion, status: "CANCELLED" }],
      version: { ...profileVersion, status: "CANCELLED" },
    })
  );
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(await screen.findByLabelText("Tutor bio"), {
    target: { value: "Keep local draft edits" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Withdraw request" }));
  await screen.findByText(
    "Request cancelled. You can create a new draft from its submission history."
  );
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Keep local draft edits");
  expect(screen.getByRole("dialog", { name: "Draft" })).toBeInTheDocument();
  expect(screen.queryByText("Pending Verification")).not.toBeInTheDocument();
});

it("never submits if the explicit save fails", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse({ message: "Draft save failed" }, 500));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(await screen.findByLabelText("Tutor bio"), {
    target: { value: "Unsaved submit changes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await confirmTutorSubmission();
  expect(await screen.findByRole("alert")).toHaveTextContent("Draft save failed");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Unsaved submit changes");
});

it("preserves local edits when saving is forbidden", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse({ message: "Forbidden" }, 403));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(await screen.findByLabelText("Tutor bio"), {
    target: { value: "Keep unsaved changes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission");
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Keep unsaved changes");
  expect(localStorage.getItem("authToken")).toBe("token");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("clears an expired session and redirects without showing private profile data", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse({ message: "Session expired" }, 401));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  await screen.findByLabelText("Tutor bio");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fenroll-tutor"));
  expect(localStorage.getItem("authToken")).toBeNull();
  expect(screen.queryByRole("region", { name: "Saved drafts" })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("keeps drafting in a modal and uses concise list rows with explicit edit and trash actions", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  const list = await screen.findByRole("region", { name: "Saved drafts" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Tutor bio")).not.toBeInTheDocument();
  const edit = within(list).getByRole("button", { name: "Edit draft 2: Second saved draft" });
  expect(edit.closest("li")).toHaveClass("rounded-md");
  expect(
    within(list).getByRole("button", { name: "Trash draft 2: Second saved draft" })
  ).toBeInTheDocument();
  fireEvent.click(edit);
  const dialog = screen.getByRole("dialog", { name: "Draft" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(within(dialog).getByLabelText("Tutor bio")).toHaveValue(second.bio);
});

it("traps keyboard focus, skips disabled submit, and restores focus after clean Escape", async () => {
  // A draft matching the approved profile keeps Submit disabled until something changes.
  const unchanged = { ...first, bio: approvedTutor.bio };
  fetchMock.mockResolvedValueOnce(
    jsonResponse(application({ tutor: approvedTutor, version: unchanged, drafts: [unchanged] }))
  );
  const { container } = render(<TutorProfileEditor />);
  const edit = await screen.findByRole("button", { name: /^Edit draft 1:/ });
  edit.focus();
  fireEvent.click(edit);
  const dialog = screen.getByRole("dialog", { name: "Draft" });
  const close = within(dialog).getByRole("button", { name: "Close Draft" });
  const submit = within(dialog).getByRole("button", { name: "Submit" });
  const save = within(dialog).getByRole("button", { name: "Save draft" });
  expect(close).toHaveFocus();
  expect(container.inert).toBe(true);
  expect(submit).toBeDisabled();
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(save).toHaveFocus();
  fireEvent.keyDown(save, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Changed bio" } });
  expect(submit).toBeEnabled();
  submit.focus();
  fireEvent.keyDown(submit, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: approvedTutor.bio } });
  fireEvent.keyDown(close, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(edit).toHaveFocus();
  expect(container.inert).toBeFalsy();
  expect(document.body.style.overflow).not.toBe("hidden");
});

it("guards closing an untouched new draft marked Not saved and discards locally without deleting", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application({ tutor: approvedTutor })));
  render(<TutorProfileEditor />);
  fireEvent.click(await screen.findByRole("button", { name: "New draft" }));
  const editor = screen.getByRole("dialog", { name: "Draft" });
  expect(screen.getByLabelText("Draft status")).toHaveTextContent("Not saved");
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("");
  fireEvent.click(within(editor).getByRole("button", { name: "Close Draft" }));
  const prompt = screen.getByRole("dialog", { name: "Unsaved changes" });
  expect(within(prompt).getByRole("button", { name: "Save" })).toBeInTheDocument();
  fireEvent.click(within(prompt).getByRole("button", { name: "Close Unsaved changes" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("");
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Draft" }), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Edit draft 1: First saved draft" })
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("guards dirty Escape and backdrop closure with an accessible prompt", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  const editor = await openTutorEditor();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Keep changes" } });
  fireEvent.keyDown(editor, { key: "Escape" });
  const prompt = screen.getByRole("dialog", { name: "Unsaved changes" });
  expect(within(prompt).getByRole("button", { name: "Save" })).toBeInTheDocument();
  expect(within(prompt).getByRole("button", { name: "Close Unsaved changes" })).toBeInTheDocument();
  expect(within(prompt).getByRole("button", { name: "Discard" })).toBeInTheDocument();
  expect(within(prompt).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  fireEvent.click(within(prompt).getByRole("button", { name: "Close Unsaved changes" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Keep changes");
  fireEvent.click(screen.getByRole("dialog", { name: "Draft" }).parentElement!);
  expect(screen.getByRole("dialog", { name: "Unsaved changes" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("closes nested consent documents with Escape without dismissing the submit confirmation or draft", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  const confirmation = screen.getByRole("dialog", { name: "Submit draft for review?" });
  const privacy = within(confirmation).getByRole("button", { name: "Privacy Policy" });
  privacy.focus();
  fireEvent.click(privacy);
  const documentDialog = screen.getByRole("dialog", { name: "Privacy Policy" });
  const close = within(documentDialog).getByRole("button", { name: "Close Privacy Policy" });
  expect(close).toHaveFocus();
  expect(confirmation.parentElement!.inert).toBe(true);
  fireEvent.keyDown(close, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Privacy Policy" })).not.toBeInTheDocument();
  expect(privacy).toHaveFocus();
  expect(confirmation.parentElement!.inert).toBeFalsy();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(privacy, { key: "Escape" });
  const returnedEditor = screen.getByRole("dialog", { name: "Draft" });
  expect(returnedEditor).toBeInTheDocument();
  expect(
    screen.queryByRole("dialog", { name: "Submit draft for review?" })
  ).not.toBeInTheDocument();
  fireEvent.keyDown(returnedEditor, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("confirms row trash, deletes only that saved draft, and preserves all others", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse(application({ drafts: [first], version: first })));
  render(<TutorProfileEditor enrollment />);
  const trash = await screen.findByRole("button", { name: "Trash draft 2: Second saved draft" });
  fireEvent.click(trash);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(trash).toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent.click(trash);
  await screen.findByText("Draft discarded.");
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/profiles/me/tutor/drafts/${second.id}`);
  expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  expect(
    screen.getByRole("button", { name: "Edit draft 1: First saved draft" })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Trash draft 2: Second saved draft" })
  ).not.toBeInTheDocument();
});

it("discards only local edits on close, retaining the persisted row and exact snapshot", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  const edit = await screen.findByRole("button", { name: "Edit draft 1: First saved draft" });
  edit.focus();
  fireEvent.click(edit);
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Local only" } });
  fireEvent.click(screen.getByRole("button", { name: "Close Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(edit).toBeInTheDocument();
  expect(edit).toHaveFocus();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(edit);
  expect(screen.getByLabelText("Tutor bio")).toHaveValue(first.bio);
});

it("submits a new application without certificates", async () => {
  const empty = { ...first, certificationUrls: [] };
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application({ status: "NONE", version: null, drafts: [] })))
    .mockResolvedValueOnce(jsonResponse(application({ version: empty, drafts: [empty] })))
    .mockResolvedValueOnce(
      jsonResponse(
        application({
          status: "PENDING",
          version: { ...empty, status: "PENDING" },
          drafts: [],
          pendingRequest: { ...empty, status: "PENDING" },
        })
      )
    );
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: first.bio } });
  fireEvent.change(screen.getByLabelText("Intro video URL"), {
    target: { value: first.introVideoUrl },
  });
  fireEvent.change(screen.getByLabelText(/Identification card URL/), {
    target: { value: first.identificationCardUrl },
  });
  expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await confirmTutorSubmission();
  await screen.findByText("Pending Verification");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).certificationUrls).toEqual([]);
  expect(fetchMock.mock.calls[2][0]).toBe(`/api/profiles/me/tutor/drafts/${first.id}/submit`);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("uses one Draft header with Saved/Not saved status and only Save draft and Submit in the fixed footer", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application())).mockResolvedValueOnce(
    jsonResponse(
      application({
        version: { ...first, bio: "Revised" },
        drafts: [{ ...first, bio: "Revised" }, second],
      })
    )
  );
  render(<TutorProfileEditor enrollment />);
  const dialog = await openTutorEditor();
  const heading = within(dialog).getByRole("heading", { name: "Draft" });
  expect(heading.parentElement).toHaveTextContent("Saved");
  expect(
    within(dialog).queryByRole("heading", { name: "Public Tutor details" })
  ).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /Discard/ })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("link", { name: "Back to dashboard" })).not.toBeInTheDocument();
  const submit = within(dialog).getByRole("button", { name: "Submit" });
  const footer = submit.parentElement!.parentElement!;
  expect(footer).toHaveClass("shrink-0");
  expect(
    within(footer)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
  ).toEqual(["Save draft", "Submit"]);
  expect(dialog).toHaveClass("overflow-hidden", "flex-col");
  expect(document.getElementById("tutor-draft-form")!.parentElement).toHaveClass(
    "min-h-0",
    "overflow-y-auto"
  );
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Revised" } });
  expect(heading.parentElement).toHaveTextContent("Not saved");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText("Draft saved. It has not been submitted for review.");
  expect(heading.parentElement).toHaveTextContent("Saved");
});

it("saves a dirty draft and closes both dialogs from the close prompt, restoring the original edit trigger", async () => {
  const saved = { ...first, bio: "Saved on close" };
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse(application({ version: saved, drafts: [saved, second] })));
  const { container } = render(<TutorProfileEditor enrollment />);
  const edit = await screen.findByRole("button", { name: "Edit draft 1: First saved draft" });
  edit.focus();
  fireEvent.click(edit);
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: saved.bio } });
  fireEvent.click(screen.getByRole("button", { name: "Close Draft" }));
  const prompt = screen.getByRole("dialog", { name: "Unsaved changes" });
  fireEvent.click(within(prompt).getByRole("button", { name: "Save" }));
  await screen.findByText("Draft saved. It has not been submitted for review.");
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/profiles/me/tutor/drafts/${first.id}`);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).bio).toBe(saved.bio);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit draft 1: Saved on close" })).toHaveFocus();
  expect(container.inert).toBeFalsy();
  expect(document.body.style.overflow).not.toBe("hidden");
});

it("keeps edits and the prompt when Save on close fails, and closing returns to editing", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(jsonResponse({ message: "Could not save" }, 500));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "Unsaved after failure" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Close Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const prompt = screen.getByRole("dialog", { name: "Unsaved changes" });
  expect(await within(prompt).findByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.queryByRole("dialog", { name: "Draft" })).not.toBeInTheDocument();
  fireEvent.click(within(prompt).getByRole("button", { name: "Close Unsaved changes" }));
  expect(screen.getByRole("dialog", { name: "Draft" })).toBeInTheDocument();
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Unsaved after failure");
  expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
});

it("requires confirmation and fresh consent to submit a valid saved row without saving another draft", async () => {
  const submitted = { ...second, status: "PENDING" as const };
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application()))
    .mockResolvedValueOnce(
      jsonResponse(application({ version: submitted, drafts: [first], pendingRequest: submitted }))
    );
  render(<TutorProfileEditor enrollment />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Submit draft 2: Second saved draft" })
  );
  const confirmation = screen.getByRole("dialog", { name: "Submit draft for review?" });
  expect(within(confirmation).getByText(/only one request at a time/)).toHaveTextContent(
    /cancel a pending request/
  );
  expect(within(confirmation).getByText(/only one request at a time/)).toHaveTextContent(
    /approved profile stays unchanged/
  );
  expect(screen.queryByRole("dialog", { name: "Draft" })).not.toBeInTheDocument();
  const confirm = within(confirmation).getByRole("button", { name: "Confirm submit" });
  expect(confirm).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(within(confirmation).getByRole("checkbox"));
  fireEvent.click(confirm);
  await screen.findByText("Pending Verification");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/profiles/me/tutor/drafts/${second.id}/submit`);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ consentAccepted: true });
});

it("opens an incomplete row for correction and clears stale field errors as it is fixed", async () => {
  const incomplete = {
    ...first,
    bio: "",
    introVideoUrl: null,
    identificationCardUrl: null,
  };
  fetchMock.mockResolvedValueOnce(
    jsonResponse(application({ version: incomplete, drafts: [incomplete] }))
  );
  render(<TutorProfileEditor enrollment />);
  fireEvent.click(await screen.findByRole("button", { name: /Submit draft 1/ }));
  expect(screen.getByRole("dialog", { name: "Draft" })).toBeInTheDocument();
  expect(
    screen.queryByRole("dialog", { name: "Submit draft for review?" })
  ).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Complete this draft");
  fireEvent.change(screen.getByRole("textbox", { name: /Tutor bio/ }), {
    target: { value: "Corrected" },
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /Tutor bio/ })).toHaveAttribute(
    "aria-invalid",
    "false"
  );
  fireEvent.change(screen.getByRole("textbox", { name: /Intro video URL/ }), {
    target: { value: "https://example.com/intro.mp4" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /Identification card URL/ }), {
    target: { value: "http://example.com/id.pdf" },
  });
  expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByRole("button", { name: "Confirm submit" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("highlights missing required fields when Submit is pressed in the editor", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse(application({ status: "NONE", version: null, drafts: [] }))
  );
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(screen.getByLabelText("Tutor bio"), { target: { value: "Only a bio" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Complete this draft before submitting for review."
  );
  expect(screen.getByRole("textbox", { name: /Intro video URL/ })).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  expect(screen.getByRole("textbox", { name: /Identification card URL/ })).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  expect(screen.getByText("Intro video URL is required.")).toBeInTheDocument();
  expect(screen.getByText("Identification card URL is required.")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /Tutor bio/ })).toHaveAttribute(
    "aria-invalid",
    "false"
  );
  expect(
    screen.queryByRole("dialog", { name: "Submit draft for review?" })
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: /Intro video URL/ }), {
    target: { value: "https://example.com/intro.mp4" },
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText("Intro video URL is required.")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("blocks both submit entry points while one request is pending", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application({ pendingRequest: profileVersion })));
  render(<TutorProfileEditor enrollment />);
  expect(
    await screen.findByRole("button", { name: "Submit draft 1: First saved draft" })
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Submit draft 2: Second saved draft" })).toBeDisabled();
  await openTutorEditor();
  expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
});

it("shows cancelled history after reload, copies it explicitly, and keeps new drafts empty", async () => {
  const cancelled = {
    ...profileVersion,
    bio: "Cancelled exact snapshot",
    status: "CANCELLED" as const,
    certificationUrls: ["https://example.com/one.pdf", "https://example.com/two.pdf"],
  };
  const copied = {
    ...cancelled,
    id: "44444444-4444-4444-8444-444444444444",
    status: "DRAFT" as const,
  };
  const response = application({ submissions: [cancelled], latestSubmittedVersion: cancelled });
  fetchMock
    .mockResolvedValueOnce(jsonResponse(application({ pendingRequest: profileVersion })))
    .mockResolvedValueOnce(jsonResponse(response))
    .mockResolvedValueOnce(jsonResponse(response))
    .mockResolvedValueOnce(
      jsonResponse({ ...response, version: copied, drafts: [copied, first, second] })
    );
  const view = render(<TutorProfileEditor enrollment />);
  fireEvent.click(await screen.findByRole("button", { name: "Withdraw request" }));
  await screen.findByText(
    "Request cancelled. You can create a new draft from its submission history."
  );
  expect(screen.getAllByRole("button", { name: /Edit draft / })).toHaveLength(2);
  view.unmount();
  render(<TutorProfileEditor enrollment />);
  const history = await screen.findByRole("region", { name: "Submission history" });
  expect(within(history).getByText("Cancelled").closest("summary")).toHaveTextContent(
    /Cancelled · Submitted/
  );
  expect(within(history).getByText(cancelled.bio)).toBeInTheDocument();
  fireEvent.click(
    within(history).getByRole("button", { name: "Create draft from cancelled submission" })
  );
  expect(await screen.findByLabelText("Tutor bio")).toHaveValue(cancelled.bio);
  expect(fetchMock.mock.calls[3][0]).toBe(
    `/api/profiles/me/tutor/submissions/${cancelled.id}/copy`
  );
  expect(fetchMock.mock.calls[3][1].method).toBe("POST");
  expect(screen.getByLabelText("Draft status")).toHaveTextContent("Saved");
  fireEvent.click(screen.getByRole("button", { name: "Close Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "New draft" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("");
  expect(screen.getByLabelText(/Avatar URL/)).toHaveValue("");
  expect(screen.getByLabelText("Draft status")).toHaveTextContent("Not saved");
});

it("replaces the draft modal with confirmation and Edit draft returns the same unsaved content with consent reset", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "Keep unsaved content" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.queryByRole("dialog", { name: "Draft" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Confirm submit" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Keep unsaved content");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Confirm submit" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("returns confirmation close to unsaved editing, while row confirmation close returns to the list", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  await openTutorEditor();
  fireEvent.change(screen.getByLabelText("Tutor bio"), {
    target: { value: "Unchanged by Cancel" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close Submit draft for review?" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue("Unchanged by Cancel");
  fireEvent.click(screen.getByRole("button", { name: "Close Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit draft 2: Second saved draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Close Submit draft for review?" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("edits the exact row snapshot from confirmation", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(application()));
  render(<TutorProfileEditor enrollment />);
  fireEvent.click(await screen.findByRole("button", { name: "Submit draft 1: First saved draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
  expect(screen.getByLabelText("Tutor bio")).toHaveValue(first.bio);
});

it("directs approved applicants to Tutor settings instead of creating a hidden draft", async () => {
  const cancelled = { ...profileVersion, status: "CANCELLED" as const };
  fetchMock.mockResolvedValueOnce(
    jsonResponse(application({ tutor: approvedTutor, submissions: [cancelled] }))
  );
  render(<TutorProfileEditor enrollment />);
  expect(
    await screen.findByRole("link", { name: "Create a draft in Tutor settings" })
  ).toHaveAttribute("href", "/settings/tutor");
  expect(
    screen.queryByRole("button", { name: "Create draft from cancelled submission" })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
