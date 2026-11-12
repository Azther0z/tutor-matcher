import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReviewFlag } from "./review-flag";
import { clearAuthToken } from "@/src/lib/auth";

const fetchMock = jest.fn();
const reviewId = "11111111-1111-4111-8111-111111111111";
const response = (body: unknown, status = 201) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("authToken", "member-token");
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

const renderFlag = (props: Partial<React.ComponentProps<typeof ReviewFlag>> = {}) =>
  render(<ReviewFlag reviewId={reviewId} reviewer="Bob S." {...props} />);
const openDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Flag review by Bob S." }));
  return screen.getByRole("dialog", { name: "Flag this review" });
};
const fillReason = (dialog: HTMLElement, text: string) =>
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason" }), {
    target: { value: text },
  });

it("offers nothing to a signed-out visitor", () => {
  localStorage.clear();
  const { container } = renderFlag();
  expect(container).toBeEmptyDOMElement();
});

it("offers nothing to the review's own author", () => {
  const { container } = renderFlag({ own: true });
  expect(container).toBeEmptyDOMElement();
});

it("removes the button when the member signs out", async () => {
  renderFlag();
  expect(screen.getByRole("button", { name: "Flag review by Bob S." })).toBeInTheDocument();
  act(() => clearAuthToken());
  await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
});

it("shows Flagged instead of the button for a review the member already flagged", () => {
  renderFlag({ flagged: true });
  expect(screen.getByText("Flagged")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("asks for a reason before sending anything", async () => {
  renderFlag();
  const dialog = openDialog();

  fillReason(dialog, "   ");
  fireEvent.click(within(dialog).getByRole("button", { name: "Flag review" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter a reason.");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("sends the trimmed reason, then shows Flagged and no button", async () => {
  fetchMock.mockResolvedValue(response({ reviewId, flagged: true }));
  renderFlag();
  const dialog = openDialog();

  fillReason(dialog, "  Abusive language  ");
  fireEvent.click(within(dialog).getByRole("button", { name: "Flag review" }));

  expect(await screen.findByText("Flagged")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(`/api/reviews/${reviewId}/flags`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer member-token" },
    body: JSON.stringify({ reason: "Abusive language" }),
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Flag review by/ })).not.toBeInTheDocument();
});

it("shows Flagged when the server says this member already flagged the review", async () => {
  fetchMock.mockResolvedValue(
    response({ code: "ALREADY_FLAGGED", message: "You have already flagged this review." }, 409)
  );
  renderFlag();
  const dialog = openDialog();

  fillReason(dialog, "Spam");
  fireEvent.click(within(dialog).getByRole("button", { name: "Flag review" }));

  expect(await screen.findByText("Flagged")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("keeps the dialog and the reason when the review is no longer available", async () => {
  fetchMock.mockResolvedValue(
    response(
      { code: "REVIEW_NOT_FOUND", message: "This review comment is no longer available." },
      404
    )
  );
  renderFlag();
  const dialog = openDialog();

  fillReason(dialog, "Spam");
  fireEvent.click(within(dialog).getByRole("button", { name: "Flag review" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "This review comment is no longer available."
  );
  expect(within(dialog).getByRole("textbox", { name: "Reason" })).toHaveValue("Spam");
  expect(within(dialog).getByRole("button", { name: "Flag review" })).toBeEnabled();
  expect(screen.queryByText("Flagged")).not.toBeInTheDocument();
});

it("sends only once while the request is pending", async () => {
  let finish!: (value: unknown) => void;
  fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  renderFlag();
  const dialog = openDialog();

  fillReason(dialog, "Spam");
  const submit = within(dialog).getByRole("button", { name: "Flag review" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(within(dialog).getByRole("button", { name: "Flagging…" })).toBeDisabled();

  await act(async () => finish(response({ reviewId, flagged: true })));
  expect(await screen.findByText("Flagged")).toBeInTheDocument();
});

it("closes without flagging when cancelled", () => {
  renderFlag();
  const dialog = openDialog();

  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
