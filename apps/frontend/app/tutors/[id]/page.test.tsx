import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TutorDetailPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/tutors/00000000-0000-4000-8000-000000000002",
  useRouter: () => ({ push: mockPush, replace: mockPush }),
  useParams: () => ({ id: "00000000-0000-4000-8000-000000000002" }),
}));

const TUTOR_ID = "00000000-0000-4000-8000-000000000002";
const soon = new Date(Date.now() + 2 * 86_400_000);
soon.setUTCHours(3, 0, 0, 0); // 10:00 in Bangkok

const profile = {
  id: TUTOR_ID,
  userId: "00000000-0000-4000-8000-000000000020",
  firstName: "Anong",
  lastName: "Pattanakul",
  verified: true,
  bio: "Approved teaching bio.",
  avatarUrl: null,
  introVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  rating: 4.5,
  reviewCount: 2,
  subjects: [
    {
      id: "calculus",
      name: "Calculus",
      description: "Limits and derivatives",
      hourlyRate: "500.00",
      format: "ONLINE",
      learningAreas: [],
      rating: 4.5,
      reviewCount: 2,
      nextOpening: soon.toISOString(),
    },
    {
      id: "physics",
      name: "Physics",
      description: null,
      hourlyRate: "650.50",
      format: "ONLINE",
      learningAreas: [],
      rating: null,
      reviewCount: 0,
      nextOpening: null,
    },
  ],
  availability: [{ startedAt: soon.toISOString(), subjectIds: ["calculus"] }],
  reviews: [
    {
      id: "review-1",
      rating: 5,
      text: "Clear explanations.",
      createdAt: "2026-09-01T10:00:00.000Z",
      subjectName: "Calculus",
      reviewer: "Bob S.",
    },
  ],
};

function respondWith(body: unknown, status = 200) {
  fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => (init?.method === "POST" ? { id: 1 } : body),
    })
  );
}

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

describe("DISC-3 tutor profile page", () => {
  it("loads the public profile without a login", async () => {
    respondWith(profile);

    render(<TutorDetailPage />);

    expect(await screen.findByRole("heading", { name: "Anong Pattanakul" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/discovery/tutors/${TUTOR_ID}/profile`,
      expect.anything()
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows bio, rating, rates, availability, reviews and the video intro", async () => {
    respondWith(profile);

    render(<TutorDetailPage />);

    expect(await screen.findByText("Approved teaching bio.")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();

    const subjects = screen.getByRole("region", { name: "Subjects and rates" });
    expect(within(subjects).getByText("฿500.00")).toBeInTheDocument();
    expect(within(subjects).getByText("฿650.50")).toBeInTheDocument();
    expect(within(subjects).getByText(/Next opening/)).toBeInTheDocument();
    expect(within(subjects).getByText("No openings right now")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Calculus/ })).toHaveAttribute(
      "href",
      `/tutors/${TUTOR_ID}/calculus`
    );

    const availability = screen.getByRole("region", { name: "Availability" });
    expect(within(availability).getByText("10:00")).toBeInTheDocument();

    const reviews = screen.getByRole("region", { name: "Reviews" });
    expect(within(reviews).getByText("Clear explanations.")).toBeInTheDocument();
    expect(within(reviews).getByText("Bob S.")).toBeInTheDocument();

    expect(screen.getByTitle("Anong’s introduction video")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
    const embed = screen.getByTitle("Anong’s introduction video");
    expect(embed).toHaveAttribute("loading", "lazy");
    expect(embed).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    expect(embed).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  });

  it("points to the subject list from Choose a subject", async () => {
    respondWith(profile);

    render(<TutorDetailPage />);

    expect(await screen.findByRole("link", { name: "Choose a subject" })).toHaveAttribute(
      "href",
      "#subjects"
    );
  });

  it("plays a video file inline and keeps other video links as links", async () => {
    respondWith({ ...profile, introVideoUrl: "https://example.com/intro.mp4" });
    const { unmount } = render(<TutorDetailPage />);
    expect(await screen.findByLabelText("Anong’s introduction video")).toHaveAttribute(
      "src",
      "https://example.com/intro.mp4"
    );
    const video = screen.getByLabelText("Anong’s introduction video");
    expect(video).toHaveAttribute("preload", "none");
    expect(video).not.toHaveAttribute("autoplay");
    unmount();

    respondWith({ ...profile, introVideoUrl: "https://example.com/watch/1" });
    render(<TutorDetailPage />);
    expect(await screen.findByRole("link", { name: "Watch introduction video" })).toHaveAttribute(
      "href",
      "https://example.com/watch/1"
    );
  });

  it.each(["250.50", "1250.50"])(
    "uses the same two-decimal %s rate in the header and subject card",
    async (rate) => {
      respondWith({ ...profile, subjects: [{ ...profile.subjects[0], hourlyRate: rate }] });
      render(<TutorDetailPage />);
      await screen.findByText("Approved teaching bio.");
      const expected = rate === "250.50" ? "฿250.50" : "฿1,250.50";
      expect(screen.getAllByText(expected)).toHaveLength(2);
    }
  );

  it("keeps insecure video-file URLs as external links rather than mixed-content players", async () => {
    respondWith({ ...profile, introVideoUrl: "http://example.com/intro.mp4" });
    render(<TutorDetailPage />);
    const link = await screen.findByRole("link", { name: "Watch introduction video" });
    expect(link).toHaveAttribute("href", "http://example.com/intro.mp4");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByLabelText("Anong’s introduction video")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Anong’s introduction video")).not.toBeInTheDocument();
  });

  it("never renders a video that is not an http(s) link", async () => {
    respondWith({ ...profile, introVideoUrl: "javascript:alert(1)" });

    render(<TutorDetailPage />);

    await screen.findByText("Approved teaching bio.");
    expect(screen.queryByTitle("Anong’s introduction video")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Watch introduction video" })
    ).not.toBeInTheDocument();
  });

  it("shows friendly empty states for a new tutor", async () => {
    respondWith({
      ...profile,
      bio: null,
      introVideoUrl: null,
      rating: null,
      reviewCount: 0,
      subjects: [],
      availability: [],
      reviews: [],
    });

    render(<TutorDetailPage />);

    expect(await screen.findByText("This tutor hasn’t added a bio yet.")).toBeInTheDocument();
    expect(screen.getByText("This tutor hasn’t listed any subjects yet.")).toBeInTheDocument();
    expect(screen.getByText(/No open slots in the next two weeks/)).toBeInTheDocument();
    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Choose a subject" })).not.toBeInTheDocument();
  });

  it("shows only an unavailable message when the profile is unavailable", async () => {
    respondWith({ message: "This tutor profile is unavailable" }, 404);

    render(<TutorDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "This tutor profile is unavailable" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("This tutor isn’t available right now.");
    expect(screen.getByRole("link", { name: "Find a tutor" })).toHaveAttribute("href", "/search");
    for (const detail of ["About", "Subjects and rates", "Availability", "Reviews"]) {
      expect(screen.queryByText(new RegExp(detail))).not.toBeInTheDocument();
    }
    expect(screen.queryByPlaceholderText(/question before booking/)).not.toBeInTheDocument();
  });

  it("offers a retry when the profile cannot be loaded", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    render(<TutorDetailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load this tutor's profile."
    );

    respondWith(profile);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Anong Pattanakul" })).toBeInTheDocument();
  });

  it("asks a signed-out visitor to log in before messaging", async () => {
    respondWith(profile);

    render(<TutorDetailPage />);

    const login = await screen.findByRole("link", { name: "Log in" });
    expect(login).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(`/tutors/${TUTOR_ID}`)}`
    );
    expect(screen.queryByPlaceholderText(/question before booking/)).not.toBeInTheDocument();
  });

  it("sends a message to the tutor and opens the conversation", async () => {
    localStorage.setItem("authToken", "token");
    respondWith(profile);

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
            toUserId: profile.userId,
            message: "Are you free this weekend?",
          }),
        })
      )
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        `/messages?with=${profile.userId}&name=Anong%20Pattanakul`
      )
    );
  });

  it("sends on Enter but not on Shift+Enter", async () => {
    localStorage.setItem("authToken", "token");
    respondWith(profile);

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
