import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TutorDetailPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/tutors/00000000-0000-4000-8000-000000000002",
  useRouter: () => ({ push: mockPush, replace: mockPush }),
  useParams: () => ({ id: "00000000-0000-4000-8000-000000000002" }),
}));

const tutor = {
  id: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000020",
  firstName: "Anong",
  lastName: "P.",
};

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

describe("TutorDetailPage", () => {
  it("redirects to login when not authenticated", async () => {
    render(<TutorDetailPage />);

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        "/login?next=%2Ftutors%2F00000000-0000-4000-8000-000000000002"
      )
    );
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
          body: JSON.stringify({
            toUserId: "00000000-0000-4000-8000-000000000020",
            message: "Are you free this weekend?",
          }),
        })
      )
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        "/messages?with=00000000-0000-4000-8000-000000000020&name=Anong%20P."
      )
    );
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

it("shows the verified badge and approved public bio without private document URLs", async () => {
  localStorage.setItem("authToken", "token");
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      ...tutor,
      status: "PUBLISHED",
      verified: true,
      bio: "Approved teaching bio.",
      identificationCardUrl: "https://example.com/private-id.pdf",
      certificationUrl: "https://example.com/private-certificate.pdf",
    }),
  });
  render(<TutorDetailPage />);
  expect(await screen.findByText("Verified")).toBeInTheDocument();
  expect(screen.getByText("Approved teaching bio.")).toBeInTheDocument();
  expect(screen.queryByText("https://example.com/private-id.pdf")).not.toBeInTheDocument();
  expect(screen.queryByText("https://example.com/private-certificate.pdf")).not.toBeInTheDocument();
});

it("shows unpublished status while keeping messaging accessible", async () => {
  localStorage.setItem("authToken", "token");
  fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      json: async () =>
        init?.method === "POST" ? { id: 1 } : { ...tutor, status: "UNPUBLISHED", verified: true },
    })
  );
  render(<TutorDetailPage />);
  expect(await screen.findByRole("status")).toHaveTextContent(
    "This tutor isn’t accepting bookings"
  );
  const textarea = screen.getByPlaceholderText("Ask Anong a question before booking…");
  fireEvent.change(textarea, { target: { value: "About our existing lesson" } });
  fireEvent.click(screen.getByRole("button", { name: "Message Anong" }));
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/messages?with="))
  );
});
