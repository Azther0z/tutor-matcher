import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FlaggedReviewsPage from "./page";
import type { FlaggedReview } from "@/src/lib/review-moderation-api";

const fetchMock = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/reviews",
  useRouter: () => ({ replace: mockReplace }),
}));

const REVIEW_ID = "11111111-1111-4111-8111-111111111111";
const pending: FlaggedReview = {
  id: REVIEW_ID,
  rating: 1,
  comment: "The tutor was useless and rude.",
  createdAt: "2026-11-01T04:00:00.000Z",
  author: "Bob Student",
  tutor: "Anong Tutor",
  subject: "Chemistry",
  removed: null,
  pendingFlags: 2,
  flags: [
    {
      id: "flag-1",
      reporter: "Dana Member",
      reason: "Abusive language",
      createdAt: "2026-11-02T04:00:00.000Z",
      outcome: null,
      decidedAt: null,
      decidedBy: null,
    },
    {
      id: "flag-2",
      reporter: "Eve Member",
      reason: "Personal attack",
      createdAt: "2026-11-03T04:00:00.000Z",
      outcome: null,
      decidedAt: null,
      decidedBy: null,
    },
  ],
};
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const decided = (outcome: "KEPT" | "REMOVED"): FlaggedReview => ({
  ...pending,
  pendingFlags: 0,
  removed:
    outcome === "REMOVED"
      ? { reason: "Harassment", removedAt: "2026-11-04T04:00:00.000Z", by: "Carol Admin" }
      : null,
  flags: pending.flags.map((flag) => ({
    ...flag,
    outcome,
    decidedAt: "2026-11-04T04:00:00.000Z",
    decidedBy: "Carol Admin",
  })),
});

beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "admin-token");
});

const row = () => screen.findByRole("region", { name: "Review by Bob Student" });

it("redirects logged-out users before loading the queue", async () => {
  localStorage.clear();
  render(<FlaggedReviewsPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Freviews"));
  expect(fetchMock).not.toHaveBeenCalled();
});

it("tells a non-admin they need admin access", async () => {
  fetchMock.mockResolvedValueOnce(response({ message: "Administrator access required" }, 403));
  render(<FlaggedReviewsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin access required");
  expect(screen.queryByRole("button", { name: "Keep review" })).not.toBeInTheDocument();
});

it("shows each pending review with its comment, flag count and every reporter's reason", async () => {
  fetchMock.mockResolvedValueOnce(response([pending]));
  render(<FlaggedReviewsPage />);

  const review = await row();
  expect(review).toHaveTextContent("reviewed Anong Tutor · Chemistry");
  expect(within(review).getByText("The tutor was useless and rude.")).toBeInTheDocument();
  expect(within(review).getByText("2 flags")).toBeInTheDocument();
  const flags = within(within(review).getByRole("list", { name: "Flags" })).getAllByRole(
    "listitem"
  );
  expect(flags[0]).toHaveTextContent("Dana Member: Abusive language");
  expect(flags[1]).toHaveTextContent("Eve Member: Personal attack");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/admin/review-flags?status=PENDING",
    expect.objectContaining({ headers: { Authorization: "Bearer admin-token" } })
  );
});

it("keeps a review after confirming, and takes it off the pending list", async () => {
  fetchMock
    .mockResolvedValueOnce(response([pending]))
    .mockResolvedValueOnce(response(decided("KEPT")));
  render(<FlaggedReviewsPage />);

  fireEvent.click(within(await row()).getByRole("button", { name: "Keep review" }));
  const dialog = screen.getByRole("dialog", { name: "Keep this review" });
  expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep review" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "Kept the review by Bob Student. The reporters were told."
  );
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/reviews/${REVIEW_ID}/moderation`,
    expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "KEEP" }) })
  );
  expect(screen.queryByRole("region", { name: "Review by Bob Student" })).not.toBeInTheDocument();
  expect(screen.getByText("No flagged reviews waiting for a decision.")).toBeInTheDocument();
});

it("needs a reason to remove a review, then sends it", async () => {
  fetchMock
    .mockResolvedValueOnce(response([pending]))
    .mockResolvedValueOnce(response(decided("REMOVED")));
  render(<FlaggedReviewsPage />);

  fireEvent.click(within(await row()).getByRole("button", { name: "Remove review" }));
  const dialog = screen.getByRole("dialog", { name: "Remove this review" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove review" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter a reason.");
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason (sent to the author)" }), {
    target: { value: "  Harassment  " },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove review" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "Removed the review by Bob Student. The reporters and the author were told."
  );
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/reviews/${REVIEW_ID}/moderation`,
    expect.objectContaining({
      body: JSON.stringify({ decision: "REMOVE", reason: "Harassment" }),
    })
  );
});

it("refreshes the queue when another Admin already decided", async () => {
  fetchMock
    .mockResolvedValueOnce(response([pending]))
    .mockResolvedValueOnce(
      response({ code: "NO_PENDING_FLAGS", message: "This review has no pending flags." }, 409)
    )
    .mockResolvedValueOnce(response([]));
  render(<FlaggedReviewsPage />);

  fireEvent.click(within(await row()).getByRole("button", { name: "Keep review" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Keep this review" })).getByRole("button", {
      name: "Keep review",
    })
  );

  expect(await screen.findByRole("status")).toHaveTextContent("This review has no pending flags.");
  expect(await screen.findByText("No flagged reviews waiting for a decision.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("shows decided reviews with their outcome, the Admin and the removal reason", async () => {
  fetchMock
    .mockResolvedValueOnce(response([pending]))
    .mockResolvedValueOnce(response([decided("REMOVED")]));
  render(<FlaggedReviewsPage />);
  await row();

  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
    target: { value: "DECIDED" },
  });

  const review = await row();
  await waitFor(() => expect(within(review).getByText("Removed")).toBeInTheDocument());
  expect(review).toHaveTextContent("Removed by Carol Admin");
  expect(review).toHaveTextContent("Reason: Harassment");
  expect(within(review).queryByRole("button", { name: "Keep review" })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/review-flags?status=DECIDED",
    expect.anything()
  );
});
