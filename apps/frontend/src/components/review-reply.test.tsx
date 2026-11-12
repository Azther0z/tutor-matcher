import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReviewReply } from "./review-reply";

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

it("lets the owner edit one reply and shows Edited after saving", async () => {
  const edited = { ...reply, text: "Corrected explanation", editedAt: "2026-11-12T01:00:00Z" };
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ reply: edited }) });
  render(<ReviewReply reviewId="r1" reply={reply} canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Edit reply" }));
  expect(screen.getByLabelText("Your public reply")).toHaveValue(reply.text);
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Your public reply"), { target: { value: edited.text } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText(/Edited ·/)).toBeInTheDocument();
  expect(screen.getByText(edited.text)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/reviews/r1/reply",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ text: edited.text, expectedUpdatedAt: reply.repliedAt }),
    })
  );
  expect(screen.getByRole("button", { name: "Edit reply" })).toBeInTheDocument();
});

it("shows the persisted Edited marker to visitors without edit controls", () => {
  render(<ReviewReply reviewId="r1" reply={{ ...reply, editedAt: "2026-11-12T01:00:00Z" }} />);
  expect(screen.getByText(/Edited ·/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("cancels an edit without changing the published reply", () => {
  render(<ReviewReply reviewId="r1" reply={reply} canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Edit reply" }));
  fireEvent.change(screen.getByLabelText("Your public reply"), {
    target: { value: "Unsaved draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByText(reply.text)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("preserves failed edit drafts and the original reply", async () => {
  fetchMock.mockRejectedValue(new Error("Network unavailable"));
  render(<ReviewReply reviewId="r1" reply={reply} canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Edit reply" }));
  fireEvent.change(screen.getByLabelText("Your public reply"), {
    target: { value: "Keep this correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
  expect(screen.getByLabelText("Your public reply")).toHaveValue("Keep this correction");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByText(reply.text)).toBeInTheDocument();
});

it("keeps a stale edit draft and explains why it cannot overwrite another edit", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({
      code: "REVIEW_REPLY_CHANGED",
      message:
        "This reply changed in another tab. Your draft is kept. Refresh the page before trying again.",
    }),
  });
  render(<ReviewReply reviewId="r1" reply={reply} canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Edit reply" }));
  fireEvent.change(screen.getByLabelText("Your public reply"), {
    target: { value: "My correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("changed in another tab");
  expect(screen.getByLabelText("Your public reply")).toHaveValue("My correction");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});
const reply = { text: "Thank you for your feedback.", repliedAt: "2026-11-12T00:00:00Z" };

it("keeps the public reply visible and hides an unsaved draft when owner access is lost", () => {
  const view = render(<ReviewReply reviewId="r1" reply={reply} canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Edit reply" }));
  fireEvent.change(screen.getByLabelText("Your public reply"), {
    target: { value: "Private unsaved draft" },
  });
  view.rerender(<ReviewReply reviewId="r1" reply={reply} canReply={false} />);
  expect(screen.getByText(reply.text)).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("shows the public reply for a visitor without reply controls", () => {
  render(<ReviewReply reviewId="r1" reply={reply} />);
  expect(screen.getByText("Tutor reply")).toBeInTheDocument();
  expect(screen.getByText(reply.text)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("has no reply controls for a Student or another Tutor", () => {
  render(<ReviewReply reviewId="r1" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("publishes once and immediately displays the public reply", async () => {
  localStorage.setItem("authToken", "tutor-token");
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ reply }) });
  render(<ReviewReply reviewId="r1" canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Reply publicly" }));
  expect(screen.getByText(/Everyone can read/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Your public reply"), { target: { value: " Thanks " } });
  fireEvent.click(screen.getByRole("button", { name: "Publish reply" }));
  expect(await screen.findByText(reply.text)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/reviews/r1/reply",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ text: "Thanks" }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer tutor-token" },
    })
  );
  expect(screen.queryByRole("button", { name: "Reply publicly" })).not.toBeInTheDocument();
});
it("keeps a failed reply draft available to retry", async () => {
  fetchMock.mockRejectedValue(new Error("Connection lost"));
  render(<ReviewReply reviewId="r1" canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Reply publicly" }));
  fireEvent.change(screen.getByLabelText("Your public reply"), {
    target: { value: "Keep my draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Publish reply" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
  expect(screen.getByLabelText("Your public reply")).toHaveValue("Keep my draft");
  expect(screen.getByRole("button", { name: "Publish reply" })).toBeEnabled();
});
it("explains deletion and disables further publish attempts", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({ code: "REVIEW_NOT_FOUND", message: "This review no longer exists." }),
  });
  render(<ReviewReply reviewId="r1" canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Reply publicly" }));
  fireEvent.change(screen.getByLabelText("Your public reply"), { target: { value: "Thanks" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish reply" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("This review no longer exists.");
  expect(screen.getByRole("button", { name: "Publish reply" })).toBeDisabled();
});
it("blocks blank drafts and allows cancelling", async () => {
  render(<ReviewReply reviewId="r1" canReply />);
  fireEvent.click(screen.getByRole("button", { name: "Reply publicly" }));
  fireEvent.change(screen.getByLabelText("Your public reply"), { target: { value: "  " } });
  expect(screen.getByRole("button", { name: "Publish reply" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  expect(fetchMock).not.toHaveBeenCalled();
});
