import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MessagesPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();
let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  usePathname: () => "/messages",
  useRouter: () => ({ push: mockPush, replace: mockPush }),
  useSearchParams: () => searchParams,
}));

const anong = {
  id: 10,
  fromUserId: 2,
  toUserId: 1,
  message: "See you tomorrow at 9!",
  createdAt: "2026-01-01T09:14:00.000Z",
  fromUser: { id: 2, firstName: "Anong", lastName: "P." },
};

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  searchParams = new URLSearchParams();
});

function mockFetchRoutes(routes: Record<string, unknown>) {
  fetchMock.mockImplementation((url: string) => {
    for (const [path, body] of Object.entries(routes)) {
      if (url.includes(path)) {
        return Promise.resolve({ ok: true, json: async () => body });
      }
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
}

describe("MessagesPage", () => {
  it("redirects to login when not authenticated", async () => {
    render(<MessagesPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login?next=%2Fmessages"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the conversation list and auto-selects the most recent thread", async () => {
    localStorage.setItem("authToken", "token");
    mockFetchRoutes({
      "/api/messages/inbox": [anong],
      "/api/messages/thread/2": [anong],
    });

    render(<MessagesPage />);

    expect((await screen.findAllByText("Anong P.")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("See you tomorrow at 9!")).length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no conversations", async () => {
    localStorage.setItem("authToken", "token");
    mockFetchRoutes({ "/api/messages/inbox": [] });

    render(<MessagesPage />);

    expect(await screen.findByText("No messages yet.")).toBeInTheDocument();
  });

  it("starts a fresh conversation from a ?with= deep link", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: "5", name: "Daniel K." });
    mockFetchRoutes({
      "/api/messages/inbox": [],
      "/api/messages/thread/5": [],
    });

    render(<MessagesPage />);

    expect(await screen.findByText("Start the conversation")).toBeInTheDocument();
    expect(await screen.findByText("No messages yet — say hi!")).toBeInTheDocument();
  });

  it("sends a message and refreshes the thread", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: "5", name: "Daniel K." });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/messages/inbox")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (init?.method === "POST" && url.includes("/api/messages")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 1 }) });
      }
      if (url.includes("/api/messages/thread/5")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(<MessagesPage />);

    const input = await screen.findByPlaceholderText("Write a message…");
    fireEvent.change(input, { target: { value: "Hi Daniel!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ toUserId: 5, message: "Hi Daniel!" }),
        })
      )
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("sends the message on Enter without a newline", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: "5", name: "Daniel K." });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/api/messages")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 1 }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<MessagesPage />);

    const input = await screen.findByPlaceholderText("Write a message…");
    fireEvent.change(input, { target: { value: "Hi Daniel!" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ toUserId: 5, message: "Hi Daniel!" }),
        })
      )
    );
  });

  it("does not send on Shift+Enter, leaving room for a newline", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: "5", name: "Daniel K." });
    mockFetchRoutes({ "/api/messages/inbox": [], "/api/messages/thread/5": [] });

    render(<MessagesPage />);

    const input = await screen.findByPlaceholderText("Write a message…");
    fireEvent.change(input, { target: { value: "Hi Daniel!" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    ).toBe(false);
  });
});
