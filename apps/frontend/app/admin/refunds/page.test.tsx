import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import RefundRequestsPage from "./page";

const fetchMock = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/refunds",
  useRouter: () => ({ replace: mockReplace }),
}));

const pending = {
  id: "22222222-2222-4222-8222-222222222222",
  reason: "UNSATISFACTORY_LESSON",
  details: "The tutor left after ten minutes",
  status: "PENDING",
  amount: "100.00",
  createdAt: "2026-11-08T04:00:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
  student: { id: "u1", firstName: "Sam", lastName: "Lee", email: "sam@example.com" },
  booking: {
    id: "33333333-3333-4333-8333-333333333333",
    status: "CONFIRMED",
    subjectName: "English",
    tutorName: "Alice Johnson",
    startedAt: "2026-11-07T09:00:00.000Z",
    endedAt: "2026-11-07T09:30:00.000Z",
  },
};

function respond(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "admin-token");
});

it("redirects logged-out users before loading any refund", async () => {
  localStorage.clear();
  render(<RefundRequestsPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Frefunds"));
  expect(fetchMock).not.toHaveBeenCalled();
});

it("shows only the access message to a user who is not an admin", async () => {
  fetchMock.mockResolvedValueOnce(respond({ code: "ADMIN_REQUIRED", message: "No" }, 403));
  render(<RefundRequestsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin access required");
  expect(screen.queryByRole("button", { name: "Approve full refund" })).not.toBeInTheDocument();
});

it("opens on pending requests with the lesson, amount and the Student's explanation", async () => {
  fetchMock.mockResolvedValueOnce(respond({ requests: [pending] }));
  render(<RefundRequestsPage />);
  const row = await screen.findByRole("region", { name: "Refund request from Sam Lee" });
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/refunds?status=PENDING", expect.anything());
  expect(within(row).getByText("฿100.00")).toBeInTheDocument();
  expect(within(row).getByText("Unsatisfactory lesson")).toBeInTheDocument();
  expect(within(row).getByText(/English with Alice Johnson/)).toBeInTheDocument();
  expect(within(row).getByText("The tutor left after ten minutes")).toBeInTheDocument();
  expect(within(row).getByRole("link", { name: "Booking" })).toHaveAttribute(
    "href",
    `/bookings/${pending.booking.id}`
  );
});

it("approves a full refund and removes it from the pending list", async () => {
  fetchMock
    .mockResolvedValueOnce(respond({ requests: [pending] }))
    .mockResolvedValueOnce(respond({ ...pending, status: "APPROVED" }));
  render(<RefundRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve full refund" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "฿100.00 refund approved for Sam Lee."
  );
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/refunds/${pending.id}/review`,
    expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "APPROVED" }) })
  );
  expect(screen.getByText("No refund requests waiting for review.")).toBeInTheDocument();
});

it("needs a reason to reject and sends it trimmed", async () => {
  fetchMock
    .mockResolvedValueOnce(respond({ requests: [pending] }))
    .mockResolvedValueOnce(respond({ ...pending, status: "REJECTED" }));
  render(<RefundRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Reject refund" }));
  expect(screen.getByText("Enter a rejection reason.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText("Rejection reason (required to reject)"), {
    target: { value: "  The lesson ran the full time  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reject refund" }));
  expect(await screen.findByRole("status")).toHaveTextContent("refund rejected for Sam Lee");
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/refunds/${pending.id}/review`,
    expect.objectContaining({
      body: JSON.stringify({
        decision: "REJECTED",
        rejectionReason: "The lesson ran the full time",
      }),
    })
  );
});

it("reloads when another admin already decided the request", async () => {
  fetchMock
    .mockResolvedValueOnce(respond({ requests: [pending] }))
    .mockResolvedValueOnce(
      respond(
        { code: "REFUND_NOT_PENDING", message: "This refund request is no longer pending" },
        409
      )
    )
    .mockResolvedValueOnce(respond({ requests: [] }));
  render(<RefundRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve full refund" }));
  expect(await screen.findByText("No refund requests waiting for review.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("shows reviewed requests in history without review actions", async () => {
  fetchMock.mockResolvedValueOnce(respond({ requests: [] })).mockResolvedValueOnce(
    respond({
      requests: [
        {
          ...pending,
          reason: "TUTOR_NO_SHOW",
          details: null,
          status: "APPROVED",
          reviewedAt: pending.createdAt,
        },
      ],
    })
  );
  render(<RefundRequestsPage />);
  await screen.findByText("No refund requests waiting for review.");
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
    target: { value: "APPROVED" },
  });
  expect(await screen.findByText("Tutor didn't show up")).toBeInTheDocument();
  expect(screen.getByText(/^Reviewed/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/refunds?status=APPROVED",
    expect.anything()
  );
  expect(screen.queryByRole("button", { name: "Approve full refund" })).not.toBeInTheDocument();
});

it("shows the Other reason with the Student's explanation", async () => {
  fetchMock.mockResolvedValueOnce(
    respond({ requests: [{ ...pending, reason: "OTHER", details: "Wrong subject taught" }] })
  );
  render(<RefundRequestsPage />);
  const row = await screen.findByRole("region", { name: "Refund request from Sam Lee" });
  expect(within(row).getByText("Other")).toBeInTheDocument();
  expect(within(row).getByText("Wrong subject taught")).toBeInTheDocument();
});
