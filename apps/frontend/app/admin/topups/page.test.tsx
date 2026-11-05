import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TopupRequestsPage from "./page";

const fetchMock = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/topups",
  useRouter: () => ({ replace: mockReplace }),
}));

const slipUrl = "https://drive.example.com/slip-500";
const pending = {
  id: "22222222-2222-4222-8222-222222222222",
  amount: "500.00",
  slipUrl,
  status: "PENDING",
  createdAt: "2026-11-03T04:00:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
  user: { id: "u1", firstName: "Sam", lastName: "Lee", email: "sam@example.com" },
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

it("redirects logged-out users before loading any top-up", async () => {
  localStorage.clear();
  render(<TopupRequestsPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Ftopups"));
  expect(fetchMock).not.toHaveBeenCalled();
});

it("shows only the access message to a user who is not an admin", async () => {
  fetchMock.mockResolvedValueOnce(respond({ code: "ADMIN_REQUIRED", message: "No" }, 403));
  render(<TopupRequestsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin access required");
  expect(screen.queryByRole("button", { name: "Approve top-up" })).not.toBeInTheDocument();
});

it("lists every top-up by default with the amount, requester and a slip link", async () => {
  fetchMock.mockResolvedValueOnce(respond({ requests: [pending] }));
  render(<TopupRequestsPage />);
  const row = await screen.findByRole("region", { name: "Top-up from Sam Lee" });
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/topups", expect.anything());
  expect(within(row).getByText("฿500.00")).toBeInTheDocument();
  expect(within(row).getByText("sam@example.com")).toBeInTheDocument();
  const link = within(row).getByRole("link", { name: `Open slip: ${slipUrl}` });
  expect(link).toHaveAttribute("href", slipUrl);
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

it("approves a slip and updates its row in the full list", async () => {
  fetchMock.mockResolvedValueOnce(respond({ requests: [pending] })).mockResolvedValueOnce(
    respond({
      id: pending.id,
      amount: pending.amount,
      slipUrl,
      status: "APPROVED",
      createdAt: pending.createdAt,
      reviewedAt: pending.createdAt,
      rejectionReason: null,
    })
  );
  render(<TopupRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve top-up" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "฿500.00 top-up approved for Sam Lee."
  );
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/topups/${pending.id}/review`,
    expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "APPROVED" }) })
  );
  const row = screen.getByRole("region", { name: "Top-up from Sam Lee" });
  expect(within(row).getByText("Approved")).toBeInTheDocument();
  expect(within(row).getByText("sam@example.com")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Approve top-up" })).not.toBeInTheDocument();
});

it("removes a reviewed slip from the Pending filter", async () => {
  fetchMock
    .mockResolvedValueOnce(respond({ requests: [] }))
    .mockResolvedValueOnce(respond({ requests: [pending] }))
    .mockResolvedValueOnce(respond({ ...pending, status: "APPROVED" }));
  render(<TopupRequestsPage />);
  await screen.findByText("No top-ups yet.");
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
    target: { value: "PENDING" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Approve top-up" }));

  expect(await screen.findByText("No top-ups waiting for review.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/admin/topups?status=PENDING",
    expect.anything()
  );
  expect(screen.queryByRole("region", { name: "Top-up from Sam Lee" })).not.toBeInTheDocument();
});

it("needs a reason to reject and sends it trimmed", async () => {
  fetchMock
    .mockResolvedValueOnce(respond({ requests: [pending] }))
    .mockResolvedValueOnce(respond({ ...pending, status: "REJECTED" }));
  render(<TopupRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Reject top-up" }));
  expect(screen.getByText("Enter a rejection reason.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText("Rejection reason (required to reject)"), {
    target: { value: "  Slip shows ฿50  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reject top-up" }));
  expect(await screen.findByRole("status")).toHaveTextContent("top-up rejected for Sam Lee");
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/topups/${pending.id}/review`,
    expect.objectContaining({
      body: JSON.stringify({ decision: "REJECTED", rejectionReason: "Slip shows ฿50" }),
    })
  );
});

it("shows the error and reloads when another admin already reviewed the slip", async () => {
  fetchMock
    .mockResolvedValueOnce(respond({ requests: [pending] }))
    .mockResolvedValueOnce(
      respond({ code: "TOPUP_NOT_PENDING", message: "This top-up is no longer pending" }, 409)
    )
    .mockResolvedValueOnce(respond({ requests: [] }));
  render(<TopupRequestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve top-up" }));
  expect(await screen.findByText("No top-ups yet.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("loads reviewed top-ups for the chosen status", async () => {
  fetchMock.mockResolvedValueOnce(respond({ requests: [] })).mockResolvedValueOnce(
    respond({
      requests: [
        {
          ...pending,
          status: "REJECTED",
          rejectionReason: "Wrong amount",
          reviewedAt: pending.createdAt,
        },
      ],
    })
  );
  render(<TopupRequestsPage />);
  await screen.findByText("No top-ups yet.");
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
    target: { value: "REJECTED" },
  });
  expect(await screen.findByText("Reason: Wrong amount")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/topups?status=REJECTED",
    expect.anything()
  );
  expect(screen.queryByRole("button", { name: "Approve top-up" })).not.toBeInTheDocument();
});
