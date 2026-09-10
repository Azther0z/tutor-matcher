import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TutorDetailPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/tutors/2",
  useRouter: () => ({ push: mockPush, replace: mockPush }),
  useParams: () => ({ id: "2" }),
}));

const tutor = { id: 2, userId: 20, firstName: "Anong", lastName: "P." };

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

describe("TutorDetailPage", () => {
  it("redirects to login when not authenticated", async () => {
    render(<TutorDetailPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login?next=%2Ftutors%2F2"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error when the tutor cannot be loaded", async () => {
    localStorage.setItem("authToken", "token");
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    render(<TutorDetailPage />);

    expect(await screen.findByText("Could not load this tutor's profile.")).toBeInTheDocument();
  });

  it("shows the tutor's name and a compose box once loaded", async () => {
    localStorage.setItem("authToken", "token");
    fetchMock.mockResolvedValue({ ok: true, json: async () => tutor });

    render(<TutorDetailPage />);

    expect(await screen.findByText("Anong P.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask Anong a question before booking…")).toBeInTheDocument();
  });

  it("sends a message to the tutor and navigates to the conversation", async () => {
    localStorage.setItem("authToken", "token");
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: 1 }) });
      }
      return Promise.resolve({ ok: true, json: async () => tutor });
    });

    render(<TutorDetailPage />);

    const textarea = await screen.findByPlaceholderText("Ask Anong a question before booking…");
    fireEvent.change(textarea, { target: { value: "Are you free this weekend?" } });
    fireEvent.click(screen.getByRole("button", { name: "Message Anong" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ toUserId: 20, message: "Are you free this weekend?" }),
        })
      )
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/messages?with=20&name=Anong%20P."));
  });

  it("sends on Enter but not on Shift+Enter", async () => {
    localStorage.setItem("authToken", "token");
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: 1 }) });
      }
      return Promise.resolve({ ok: true, json: async () => tutor });
    });

    render(<TutorDetailPage />);

    const textarea = await screen.findByPlaceholderText("Ask Anong a question before booking…");
    fireEvent.change(textarea, { target: { value: "Hi!" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    ).toBe(false);

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages",
        expect.objectContaining({ method: "POST" })
      )
    );
  });
});
