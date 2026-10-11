import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TutorRequestsPage from "./page";
import { jsonResponse, reviewRequest } from "@/src/test/tutor-profile-fixtures";

const fetchMock = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/tutor-requests",
  useRouter: () => ({ replace: mockReplace }),
}));
beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "admin-token");
});

it("redirects logged-out users before loading any private request", async () => {
  localStorage.clear();
  render(<TutorRequestsPage />);
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Ftutor-requests")
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it("handles server 403 without displaying review controls", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Forbidden" }, 403));
  render(<TutorRequestsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin access required");
  expect(screen.queryByRole("button", { name: "Approve request" })).not.toBeInTheDocument();
});

it("highlights changed fields and shows current and submitted content", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse([reviewRequest]));
  render(<TutorRequestsPage />);
  await screen.findByRole("button", { name: "Approve request" });
  const bioRow = screen.getByRole("rowheader", { name: "Bio Changed" }).closest("tr")!;
  expect(within(bioRow).getByText(reviewRequest.currentProfile!.bio!)).toBeInTheDocument();
  expect(within(bioRow).getByText(reviewRequest.bio!)).toBeInTheDocument();
  expect(bioRow).toHaveClass("bg-amber-500/10");
  expect(screen.getByRole("rowheader", { name: "Avatar URL" })).toBeInTheDocument();
  expect(screen.getAllByText("Changed")).toHaveLength(1);
});

it.each([
  ["replaced", ["https://example.com/replacement-certificate.pdf"]],
  ["removed", []],
])(
  "highlights an extra certificate %s even when the singular URL is unchanged",
  async (_, extras) => {
    const primary = reviewRequest.certificationUrl!;
    const previousExtra = "https://example.com/extra-certificate.pdf";
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          ...reviewRequest,
          certificationUrls: [primary, ...extras],
          currentProfile: {
            ...reviewRequest.currentProfile,
            certificationUrls: [primary, previousExtra],
          },
        },
      ])
    );
    render(<TutorRequestsPage />);
    await screen.findByRole("button", { name: "Approve request" });
    const row = screen
      .getByRole("rowheader", {
        name: "Teaching certifications / portfolio Changed",
      })
      .closest("tr")!;
    expect(row).toHaveClass("bg-amber-500/10");
    const [current, submitted] = within(row).getAllByRole("cell");
    expect(within(current).getByRole("link", { name: previousExtra })).toHaveAttribute(
      "href",
      previousExtra
    );
    expect(within(submitted).getByRole("link", { name: primary })).toHaveAttribute("href", primary);
    expect(within(submitted).queryByRole("link", { name: previousExtra })).not.toBeInTheDocument();
    for (const url of extras) {
      expect(within(submitted).getByRole("link", { name: url })).toHaveAttribute("href", url);
    }
  }
);

it("does not highlight certificate collections that differ only in order", async () => {
  const primary = reviewRequest.certificationUrl!;
  const extra = "https://example.com/extra-certificate.pdf";
  fetchMock.mockResolvedValueOnce(
    jsonResponse([
      {
        ...reviewRequest,
        certificationUrls: [extra, primary],
        currentProfile: { ...reviewRequest.currentProfile, certificationUrls: [primary, extra] },
      },
    ])
  );
  render(<TutorRequestsPage />);
  await screen.findByRole("button", { name: "Approve request" });
  const row = screen
    .getByRole("rowheader", {
      name: "Teaching certifications / portfolio",
    })
    .closest("tr")!;
  expect(row).not.toHaveClass("bg-amber-500/10");
  expect(within(row).getAllByRole("link", { name: extra })).toHaveLength(2);
});

it("shows initial applications with no current profile and approves via the review endpoint", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse([{ ...reviewRequest, currentProfile: null }]))
    .mockResolvedValueOnce(jsonResponse({ ...reviewRequest, status: "APPROVED" }));
  render(<TutorRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve request" }));
  expect(await screen.findByText("Request approved for Ada Lovelace.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/tutor-requests/${reviewRequest.id}/review`,
    expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "APPROVED" }),
    })
  );
  expect(screen.getByText("No pending tutor requests.")).toBeInTheDocument();
});

it("requires a nonblank rejection reason and submits the trimmed reason", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse([reviewRequest]))
    .mockResolvedValueOnce(jsonResponse({ ...reviewRequest, status: "REJECTED" }));
  render(<TutorRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Reject request" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a rejection reason.");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText(/Rejection reason/), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Reject request" }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText(/Rejection reason/), {
    target: { value: "  Please clarify the bio.  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reject request" }));
  expect(await screen.findByText("Request rejected for Ada Lovelace.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/tutor-requests/${reviewRequest.id}/review`,
    expect.objectContaining({
      body: JSON.stringify({ decision: "REJECTED", rejectionReason: "Please clarify the bio." }),
    })
  );
});

it("keeps the request when review fails and handles stale reviews", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse([reviewRequest]))
    .mockResolvedValueOnce(
      jsonResponse({ message: "Request is no longer pending. Refresh requests." }, 409)
    );
  render(<TutorRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve request" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Request is no longer pending");
  expect(screen.getByRole("button", { name: "Approve request" })).toBeEnabled();
});

it("removes sensitive content if review returns 403", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse([reviewRequest]))
    .mockResolvedValueOnce(jsonResponse({}, 403));
  render(<TutorRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve request" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin access required");
  expect(screen.queryByText(reviewRequest.user.email)).not.toBeInTheDocument();
});

it("does not turn unsafe document URLs into clickable links", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse([
      { ...reviewRequest, currentProfile: null, identificationCardUrl: "javascript:alert(1)" },
    ])
  );
  render(<TutorRequestsPage />);
  await screen.findByRole("button", { name: "Approve request" });
  expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "javascript:alert(1)" })).not.toBeInTheDocument();
});

it("filters past submissions with read-only content, reasons, and no review actions", async () => {
  const past = ["APPROVED", "REJECTED", "CANCELLED"].map((status, index) => ({
    ...reviewRequest,
    id: `past-${index}`,
    status,
    bio: `${status} content`,
    rejectionReason: status === "REJECTED" ? "Unclear experience" : null,
    reviewedAt: status === "CANCELLED" ? null : "2026-10-12T12:00:00.000Z",
  }));
  fetchMock.mockResolvedValueOnce(jsonResponse([reviewRequest, ...past]));
  render(<TutorRequestsPage />);
  await screen.findByRole("button", { name: "Approve request" });
  for (const status of ["APPROVED", "REJECTED", "CANCELLED"]) {
    fireEvent.change(screen.getByRole("combobox", { name: "Submission status" }), {
      target: { value: status },
    });
    expect(screen.getByText(`${status} content`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject request" })).not.toBeInTheDocument();
    if (status === "REJECTED")
      expect(screen.getByText("Reason: Unclear experience")).toBeInTheDocument();
  }
  fireEvent.change(screen.getByRole("combobox", { name: "Submission status" }), {
    target: { value: "ALL" },
  });
  expect(screen.getAllByRole("region")).toHaveLength(4);
  expect(screen.getAllByRole("button", { name: "Approve request" })).toHaveLength(1);
});
