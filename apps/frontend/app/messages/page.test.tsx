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

const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";

const anongMessage = {
  id: "00000000-0000-4000-8000-000000000010",
  fromUserId: OTHER_USER_ID,
  toUserId: USER_ID,
  message: "See you tomorrow at 9!",
  createdAt: "2026-01-01T09:14:00.000Z",
};
const anong = {
  userId: OTHER_USER_ID,
  name: "Anong P.",
  lastMessage: "See you tomorrow at 9!",
  lastMessageAt: "2026-01-01T09:14:00.000Z",
  sentByMe: false,
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
      "/api/messages/conversations": [anong],
      [`/api/messages/thread/${OTHER_USER_ID}`]: [anongMessage],
    });

    render(<MessagesPage />);

    expect((await screen.findAllByText("Anong P.")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("See you tomorrow at 9!")).length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no conversations", async () => {
    localStorage.setItem("authToken", "token");
    mockFetchRoutes({ "/api/messages/conversations": [] });

    render(<MessagesPage />);

    expect(await screen.findByText("No messages yet.")).toBeInTheDocument();
  });

  it("starts a fresh conversation from a ?with= deep link", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: OTHER_USER_ID, name: "Daniel K." });
    mockFetchRoutes({
      "/api/messages/conversations": [],
      [`/api/messages/thread/${OTHER_USER_ID}`]: [],
    });

    render(<MessagesPage />);

    expect(await screen.findByText("Start the conversation")).toBeInTheDocument();
    expect(await screen.findByText("No messages yet — say hi!")).toBeInTheDocument();
  });

  it("lists a conversation the user started even before the other person replies", async () => {
    localStorage.setItem("authToken", "token");
    mockFetchRoutes({
      "/api/messages/conversations": [
        {
          userId: OTHER_USER_ID,
          name: "Daniel K.",
          lastMessage: "Hi Daniel!",
          lastMessageAt: "2026-01-02T10:00:00.000Z",
          sentByMe: true,
        },
      ],
      [`/api/messages/thread/${OTHER_USER_ID}`]: [],
    });

    render(<MessagesPage />);

    const entry = await screen.findByRole("button", { name: /Daniel K\./ });
    expect(entry).toHaveTextContent("You: Hi Daniel!");
    expect(screen.queryByText("No messages yet.")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/messages/conversations", expect.anything());
  });

  it("adds a new conversation to the list once the first message is sent", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: OTHER_USER_ID, name: "Daniel K." });
    let sent = false;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/messages/conversations")) {
        const list = sent
          ? [
              {
                userId: OTHER_USER_ID,
                name: "Daniel K.",
                lastMessage: "Hi Daniel!",
                lastMessageAt: "2026-01-02T10:00:00.000Z",
                sentByMe: true,
              },
            ]
          : [];
        return Promise.resolve({ ok: true, json: async () => list });
      }
      if (init?.method === "POST") {
        sent = true;
        return Promise.resolve({ ok: true, json: async () => ({ id: 1 }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<MessagesPage />);
    expect(await screen.findByText("Start the conversation")).toBeInTheDocument();

    fireEvent.change(await screen.findByPlaceholderText("Write a message…"), {
      target: { value: "Hi Daniel!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("You: Hi Daniel!")).toBeInTheDocument();
    expect(screen.queryByText("Start the conversation")).not.toBeInTheDocument();
  });

  it("sends a message and refreshes the thread", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: OTHER_USER_ID, name: "Daniel K." });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/messages/conversations")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (init?.method === "POST" && url.includes("/api/messages")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 1 }) });
      }
      if (url.includes(`/api/messages/thread/${OTHER_USER_ID}`)) {
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
          body: JSON.stringify({ toUserId: OTHER_USER_ID, message: "Hi Daniel!" }),
        })
      )
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("sends the message on Enter without a newline", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: OTHER_USER_ID, name: "Daniel K." });

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
          body: JSON.stringify({ toUserId: OTHER_USER_ID, message: "Hi Daniel!" }),
        })
      )
    );
  });

  it("does not send on Shift+Enter, leaving room for a newline", async () => {
    localStorage.setItem("authToken", "token");
    searchParams = new URLSearchParams({ with: OTHER_USER_ID, name: "Daniel K." });
    mockFetchRoutes({
      "/api/messages/conversations": [],
      [`/api/messages/thread/${OTHER_USER_ID}`]: [],
    });

    render(<MessagesPage />);

    const input = await screen.findByPlaceholderText("Write a message…");
    fireEvent.change(input, { target: { value: "Hi Daniel!" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    ).toBe(false);
  });
});
