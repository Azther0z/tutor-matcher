import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SearchPage from "./page";
import { jsonResponse } from "@/src/test/tutor-profile-fixtures";
import type { TutorSearchResponse, TutorSearchResult } from "@/src/lib/discovery-api";

let mockParams = new URLSearchParams();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => mockParams,
}));

const mathematics = { id: "area-math", name: "Mathematics" };
const physics = { id: "area-physics", name: "Physics" };
const fetchMock = jest.fn();

function tutor(overrides: Partial<TutorSearchResult> = {}): TutorSearchResult {
  return {
    id: "tutor-anong",
    firstName: "Anong",
    lastName: "Pattana",
    bio: "I teach calculus for A-Level students.",
    verified: true,
    rating: 4.5,
    reviewCount: 2,
    classesTaught: 3,
    fromHourlyRate: "300.00",
    subjects: [
      {
        id: "subject-calculus",
        name: "A-Level Calculus",
        description: "Limits and derivatives",
        hourlyRate: "300.00",
        format: "ONLINE",
        learningAreas: [mathematics],
      },
    ],
    ...overrides,
  };
}

function page(tutors: TutorSearchResult[], extra: Partial<TutorSearchResponse> = {}) {
  return { tutors, page: 1, pageSize: 12, total: tutors.length, totalPages: 1, ...extra };
}

function respondWith(...responses: Array<ReturnType<typeof jsonResponse>>) {
  const queue = [...responses];
  fetchMock.mockImplementation((path: string) => {
    if (path === "/api/discovery/learning-areas") {
      return Promise.resolve(jsonResponse({ learningAreas: [mathematics, physics] }));
    }
    return Promise.resolve(queue.length > 1 ? queue.shift() : queue[0]);
  });
}

const searchCalls = () =>
  fetchMock.mock.calls
    .map(([path]) => path as string)
    .filter((path) => path.startsWith("/api/discovery/tutors"));

beforeEach(() => {
  mockParams = new URLSearchParams();
  mockReplace.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("SearchPage (DISC-1)", () => {
  it("is public and searches with the filters in the URL", async () => {
    mockParams = new URLSearchParams(
      "q=calculus&learningAreaId=area-math&maxPrice=600&minRating=4&format=ONLINE&sort=price_asc"
    );
    respondWith(
      jsonResponse(
        page([tutor(), tutor({ id: "tutor-ben", firstName: "Ben", rating: null, reviewCount: 0 })])
      )
    );
    render(<SearchPage />);

    expect(await screen.findByText("2 tutors found")).toBeInTheDocument();
    expect(searchCalls()).toEqual([
      "/api/discovery/tutors?q=calculus&learningAreaId=area-math&maxPrice=600&minRating=4&format=ONLINE&sort=price_asc",
    ]);
    // No login: the request carries no bearer token.
    expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
    expect(mockReplace).not.toHaveBeenCalled();

    const card = screen.getByRole("link", { name: "Anong Pattana" });
    expect(card).toHaveAttribute("href", "/tutors/tutor-anong");
    expect(within(card).getByText("Verified")).toBeInTheDocument();
    expect(card).toHaveTextContent("★ 4.5 (2 reviews) · 3 classes taught");
    expect(card).toHaveTextContent("A-Level Calculus");
    expect(card).toHaveTextContent("Mathematics · Online");
    expect(card).toHaveTextContent("from ฿300.00 / hr");
    expect(screen.getByRole("link", { name: "Ben Pattana" })).toHaveTextContent("New tutor");

    expect(screen.getByLabelText("Keyword")).toHaveValue("calculus");
    expect(await screen.findByRole("option", { name: "Mathematics" })).toBeInTheDocument();
    expect(screen.getByLabelText("Learning area")).toHaveValue("area-math");
    expect(screen.getByLabelText("Max price (฿ / hr)")).toHaveValue(600);
    expect(screen.getByRole("button", { name: "Online" })).toHaveAttribute("aria-pressed", "true");
  });

  it("re-filters immediately and goes back to page 1 when a filter changes", async () => {
    mockParams = new URLSearchParams("sort=rating&page=2");
    respondWith(jsonResponse(page([tutor()], { page: 2, totalPages: 2, total: 13 })));
    render(<SearchPage />);
    await screen.findByRole("option", { name: "Physics" });

    fireEvent.change(screen.getByLabelText("Learning area"), { target: { value: "area-physics" } });
    expect(mockReplace).toHaveBeenLastCalledWith(
      "/search?learningAreaId=area-physics&sort=rating",
      {
        scroll: false,
      }
    );
    fireEvent.change(screen.getByLabelText("Minimum rating"), { target: { value: "4.5" } });
    expect(mockReplace).toHaveBeenLastCalledWith("/search?minRating=4.5&sort=rating", {
      scroll: false,
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), {
      target: { value: "price_desc" },
    });
    expect(mockReplace).toHaveBeenLastCalledWith("/search?sort=price_desc", { scroll: false });
  });

  it("waits for typing to pause before searching by keyword or price", async () => {
    respondWith(jsonResponse(page([tutor()])));
    render(<SearchPage />);
    await screen.findByText("1 tutor found");

    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "cal" } });
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "calculus " } });
    fireEvent.change(screen.getByLabelText("Max price (฿ / hr)"), { target: { value: "500" } });
    act(() => jest.advanceTimersByTime(299));
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/search?q=calculus&maxPrice=500", { scroll: false });
  });

  it("keeps a filter picked while the keyword is still waiting to apply", async () => {
    respondWith(jsonResponse(page([tutor()])));
    const { rerender } = render(<SearchPage />);
    await screen.findByRole("option", { name: "Physics" });

    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "calculus" } });
    act(() => jest.advanceTimersByTime(100));
    fireEvent.change(screen.getByLabelText("Learning area"), { target: { value: "area-physics" } });
    expect(mockReplace).toHaveBeenLastCalledWith("/search?learningAreaId=area-physics", {
      scroll: false,
    });
    // The router has applied the area before the keyword timer fires.
    mockParams = new URLSearchParams("learningAreaId=area-physics");
    rerender(<SearchPage />);
    act(() => jest.advanceTimersByTime(300));
    expect(mockReplace).toHaveBeenLastCalledWith("/search?q=calculus&learningAreaId=area-physics", {
      scroll: false,
    });
  });

  it("shows a no-results state with suggestions that broaden the search", async () => {
    mockParams = new URLSearchParams("q=quantum&learningAreaId=area-math&maxPrice=100");
    respondWith(jsonResponse(page([])));
    render(<SearchPage />);

    expect(
      await screen.findByRole("heading", { name: "No tutors match these filters" })
    ).toBeInTheDocument();
    expect(screen.getByText("Try broadening your search:")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Search all areas, not just Mathematics" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove the price limit" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search?q=quantum&learningAreaId=area-math", {
      scroll: false,
    });
    fireEvent.click(screen.getByRole("button", { name: 'Remove keyword "quantum"' }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search?learningAreaId=area-math&maxPrice=100", {
      scroll: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search", { scroll: false });
  });

  it("says no tutors are listed yet when there are no filters to broaden", async () => {
    respondWith(jsonResponse(page([])));
    render(<SearchPage />);
    expect(
      await screen.findByText("No tutors are listed yet. Check back soon.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
  });

  it("pages through results", async () => {
    mockParams = new URLSearchParams("q=math&page=2");
    respondWith(jsonResponse(page([tutor()], { page: 2, totalPages: 3, total: 30 })));
    render(<SearchPage />);
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search?q=math&page=3", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search?q=math", { scroll: false });
  });

  it("shows an error and retries the same search", async () => {
    respondWith(
      jsonResponse({ message: "Internal server error" }, 500),
      jsonResponse(page([tutor()]))
    );
    render(<SearchPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Anong Pattana" })).toBeInTheDocument();
    await waitFor(() => expect(searchCalls()).toHaveLength(2));
  });
});
