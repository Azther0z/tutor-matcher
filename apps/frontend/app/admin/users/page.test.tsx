import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdminUsersPage from "./page";
import { jsonResponse } from "@/src/test/tutor-profile-fixtures";
import type { ManagedUser, ManagedUserDetail } from "@/src/lib/admin-users-api";

const fetchMock = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useRouter: () => ({ replace: mockReplace }),
}));

const bob: ManagedUser = {
  id: "b0b00000-0000-4000-8000-000000000001",
  firstName: "Bob",
  lastName: "Builder",
  email: "bob@example.com",
  isAdmin: false,
  isTutor: false,
  restriction: null,
};
const alice: ManagedUser = {
  ...bob,
  id: "a11ce000-0000-4000-8000-000000000002",
  firstName: "Alice",
  lastName: "Anong",
  email: "alice@example.com",
  isTutor: true,
};
const carol: ManagedUser = {
  ...bob,
  id: "ca401000-0000-4000-8000-000000000003",
  firstName: "Carol",
  lastName: "Admin",
  email: "carol@example.com",
  isAdmin: true,
};

function resultPage(results: ManagedUser[], extra: object = {}) {
  return { results, page: 1, pageSize: 20, total: results.length, totalPages: 1, ...extra };
}

function detail(user: ManagedUser, extra: Partial<ManagedUserDetail> = {}): ManagedUserDetail {
  return { ...user, actions: [], ...extra };
}

beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "admin-token");
});

async function selectUser(name: RegExp, loaded: ManagedUserDetail) {
  fetchMock.mockResolvedValueOnce(jsonResponse(loaded));
  fireEvent.click(await screen.findByRole("button", { name }));
  return screen.findByRole("heading", { level: 2, name: `${loaded.firstName} ${loaded.lastName}` });
}

it("redirects logged-out users before loading any account", async () => {
  localStorage.clear();
  render(<AdminUsersPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Fusers"));
  expect(fetchMock).not.toHaveBeenCalled();
});

it("tells a non-admin they need admin access", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Administrator access required" }, 403));
  render(<AdminUsersPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin access required");
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});

it("lists accounts, searches by name and filters Students and Tutors", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(resultPage([alice, bob])))
    .mockResolvedValueOnce(jsonResponse(resultPage([bob])))
    .mockResolvedValueOnce(jsonResponse(resultPage([])));
  render(<AdminUsersPage />);

  const rows = await screen.findAllByRole("listitem");
  expect(rows.map((row) => row.textContent)).toEqual([
    "Alice Anongalice@example.comTutor",
    "Bob Builderbob@example.comStudent",
  ]);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/users?role=all&page=1",
    expect.objectContaining({ headers: { Authorization: "Bearer admin-token" } })
  );

  fireEvent.change(screen.getByRole("searchbox", { name: "Search by name" }), {
    target: { value: "  bob " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument());
  expect(screen.getByText("1 user")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/users?role=all&page=1&q=bob",
    expect.anything()
  );

  fireEvent.click(screen.getByRole("button", { name: "Tutor" }));
  expect(await screen.findByText("No users match this search.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tutor" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/users?role=tutor&page=1&q=bob",
    expect.anything()
  );
});

it("pages through long result lists", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(resultPage([alice], { total: 21, totalPages: 2 })))
    .mockResolvedValueOnce(jsonResponse(resultPage([bob], { page: 2, total: 21, totalPages: 2 })));
  render(<AdminUsersPage />);

  expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
  expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/users?role=all&page=2", expect.anything());
});

it("retries a failed user search with its current filters", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Please retry" }, 500));
  render(<AdminUsersPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Please retry");

  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([bob])));
  fireEvent.click(screen.getByRole("button", { name: "Retry user search" }));

  expect(await screen.findByText("bob@example.com")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/users?role=all&page=1", expect.anything());
});

it("keeps pagination on the requested page while the results are pending", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([alice], { total: 41, totalPages: 3 })));
  render(<AdminUsersPage />);
  await screen.findByText("Page 1 of 3");
  let finish!: (response: ReturnType<typeof jsonResponse>) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(fetchMock).toHaveBeenCalledTimes(2);

  await act(async () => {
    finish(jsonResponse(resultPage([bob], { page: 2, total: 41, totalPages: 3 })));
  });
  expect(await screen.findByText("Page 2 of 3")).toBeVisible();
  expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
});

it("retries loading the selected account after a network failure", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([bob])));
  render(<AdminUsersPage />);
  await screen.findByText("bob@example.com");
  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: /Bob Builder/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");

  fetchMock.mockResolvedValueOnce(jsonResponse(detail(bob)));
  fireEvent.click(screen.getByRole("button", { name: "Retry account" }));

  expect(await screen.findByRole("heading", { level: 2, name: "Bob Builder" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Ban" })).toBeEnabled();
});

it("submits a restriction once while pending and preserves the reason for retry", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([bob])));
  render(<AdminUsersPage />);
  await selectUser(/Bob Builder/, detail(bob));
  fireEvent.click(screen.getByRole("button", { name: "Ban" }));
  const dialog = await screen.findByRole("dialog", { name: "Ban Bob Builder" });
  const reason = within(dialog).getByRole("textbox", { name: "Reason" });
  fireEvent.change(reason, { target: { value: "Fraud" } });
  let finish!: (response: ReturnType<typeof jsonResponse>) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const form = reason.closest("form")!;

  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(within(dialog).getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(dialog).toBeInTheDocument();

  await act(async () => {
    finish(jsonResponse({ message: "Please retry" }, 500));
  });
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Please retry");
  expect(reason).toHaveValue("Fraud");
  fetchMock.mockResolvedValueOnce(
    jsonResponse(
      detail(bob, {
        restriction: { type: "BAN", reason: "Fraud", endsAt: null },
      }),
      201
    )
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Ban account" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Bob Builder is banned.");
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it("offers Message, Suspend and Ban for the selected user", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([bob])));
  render(<AdminUsersPage />);

  const heading = await selectUser(/Bob Builder/, detail(bob));
  expect(heading).toHaveFocus();
  expect(fetchMock).toHaveBeenLastCalledWith(`/api/admin/users/${bob.id}`, expect.anything());
  expect(screen.getByRole("button", { name: /Bob Builder/ })).toHaveAttribute(
    "aria-current",
    "true"
  );
  expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute(
    "href",
    `/messages?with=${bob.id}&name=Bob%20Builder`
  );
  expect(screen.getByRole("button", { name: "Suspend" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Ban" })).toBeEnabled();
  expect(screen.getByText("Active: this account has full access.")).toBeInTheDocument();
  expect(screen.getByText("No suspensions or bans recorded.")).toBeInTheDocument();
});

it("suspends with a reason and a chosen length, then shows the recorded action", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([bob])));
  render(<AdminUsersPage />);
  await selectUser(/Bob Builder/, detail(bob));

  fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
  const dialog = await screen.findByRole("dialog", { name: "Suspend Bob Builder" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Suspend account" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter a reason.");
  expect(fetchMock).toHaveBeenCalledTimes(2);

  const restriction = {
    type: "SUSPEND" as const,
    reason: "Spam",
    endsAt: "2026-11-02T07:00:00.000Z",
  };
  fetchMock.mockResolvedValueOnce(
    jsonResponse(
      detail(bob, {
        restriction,
        actions: [
          {
            id: "act-1",
            ...restriction,
            createdAt: "2026-10-26T07:00:00.000Z",
            admin: "Carol Admin",
          },
        ],
      }),
      201
    )
  );
  fireEvent.click(within(dialog).getByRole("radio", { name: "7 days" }));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason" }), {
    target: { value: "  Spam  " },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Suspend account" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "Bob Builder is suspended until 2 Nov 2026, 14:00 (Bangkok time)."
  );
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/users/${bob.id}/actions`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ type: "SUSPEND", reason: "Spam", days: 7 }),
    })
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const history = screen.getByRole("region", { name: "Administration history" });
  expect(history).toHaveTextContent("Suspended until 2 Nov 2026, 14:00 (Bangkok time)");
  expect(history).toHaveTextContent("Reason: Spam");
  expect(history).toHaveTextContent("By Carol Admin on 26 Oct 2026, 14:00 (Bangkok time)");
  expect(screen.getByRole("button", { name: /Bob Builder/ })).toHaveTextContent("Suspended");
});

it("rejects banning an account that is already banned", async () => {
  const banned = { ...bob, restriction: { type: "BAN" as const, reason: "Fraud", endsAt: null } };
  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([banned])));
  render(<AdminUsersPage />);
  await selectUser(/Bob Builder/, detail(banned));
  expect(screen.getByText("Reason: Fraud")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Ban" }));
  const dialog = await screen.findByRole("dialog", { name: "Ban Bob Builder" });
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "This account is already banned" }, 409));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason" }), {
    target: { value: "Again" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Ban account" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "This account is already banned"
  );
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/admin/users/${bob.id}/actions`,
    expect.objectContaining({ body: JSON.stringify({ type: "BAN", reason: "Again" }) })
  );
  expect(within(dialog).getByRole("button", { name: "Ban account" })).toBeEnabled();
});

it("bans a Tutor after warning that their listing will be unpublished", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([alice])));
  render(<AdminUsersPage />);
  await selectUser(/Alice Anong/, detail(alice));

  fireEvent.click(screen.getByRole("button", { name: "Ban" }));
  const dialog = await screen.findByRole("dialog", { name: "Ban Alice Anong" });
  expect(dialog).toHaveTextContent("Their tutor listing will be unpublished");
  expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();

  const restriction = { type: "BAN" as const, reason: "Fake identity", endsAt: null };
  fetchMock.mockResolvedValueOnce(jsonResponse(detail(alice, { restriction }), 201));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason" }), {
    target: { value: "Fake identity" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Ban account" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Alice Anong is banned.");
  expect(screen.getByRole("button", { name: /Alice Anong/ })).toHaveTextContent("Banned");
});

it("does not offer Suspend or Ban for administrator accounts", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(resultPage([carol])));
  render(<AdminUsersPage />);
  await selectUser(/Carol Admin/, detail(carol));

  expect(screen.getByRole("button", { name: "Suspend" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Ban" })).toBeDisabled();
  expect(screen.getByText("Administrator accounts can't be suspended or banned.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Message" })).toBeInTheDocument();
});
