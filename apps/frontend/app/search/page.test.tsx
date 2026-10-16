import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SearchPage from "./page";
import { jsonResponse } from "@/src/test/tutor-profile-fixtures";
import type { SubjectSearchResult, TutorSearchResponse } from "@/src/lib/discovery-api";

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

function subject(overrides: Partial<SubjectSearchResult> = {}): SubjectSearchResult {
  return {
    id: "subject-calculus",
    name: "A-Level Calculus",
    description: "Limits and derivatives",
    hourlyRate: "300.00",
    format: "ONLINE",
    learningAreas: [mathematics],
    rating: 4.5,
    reviewCount: 2,
    classesTaught: 3,
    tutor: {
      id: "tutor-anong",
      firstName: "Anong",
      lastName: "Pattana",
      bio: "I teach maths.",
      verified: true,
    },
    ...overrides,
  };
}

function page(results: SubjectSearchResult[], extra: Partial<TutorSearchResponse> = {}) {
  return {
    results,
    page: 1,
    pageSize: 12,
    total: results.length,
    totalPages: 1,
    ...extra,
  };
}

let priceRange: { min: string; max: string } | null = { min: "75.00", max: "860.00" };

function respondWith(...responses: Array<ReturnType<typeof jsonResponse>>) {
  const queue = [...responses];
  fetchMock.mockImplementation((path: string) => {
    if (path === "/api/discovery/learning-areas") {
      return Promise.resolve(jsonResponse({ learningAreas: [mathematics, physics] }));
    }
    if (path === "/api/discovery/price-range") {
      return Promise.resolve(jsonResponse({ priceRange }));
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
  priceRange = { min: "75.00", max: "860.00" };
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
      "q=calculus&tutorName=anong&learningAreaId=area-math&minPrice=200&maxPrice=600&minRating=3.5&format=ONLINE&sort=price_asc"
    );
    respondWith(jsonResponse(page([subject()])));
    render(<SearchPage />);

    expect(await screen.findByText("1 subject found")).toBeInTheDocument();
    expect(searchCalls()).toEqual([
      "/api/discovery/tutors?q=calculus&tutorName=anong&learningAreaId=area-math&minPrice=200&maxPrice=600&minRating=3.5&format=ONLINE&sort=price_asc",
    ]);
    // No login: the request carries no bearer token.
    expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
    expect(mockReplace).not.toHaveBeenCalled();

    expect(screen.getByLabelText("Keyword")).toHaveValue("calculus");
    expect(screen.getByLabelText("Tutor name")).toHaveValue("anong");
    expect(await screen.findByRole("option", { name: "Mathematics" })).toBeInTheDocument();
    expect(screen.getByLabelText("Learning area")).toHaveValue("area-math");
    expect(screen.getByLabelText("Minimum price")).toHaveValue("200");
    expect(screen.getByLabelText("Maximum price")).toHaveValue("600");
    expect(screen.getByText("฿200 to ฿600 / hr")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3.5 stars and up" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByText("3.5 and up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Online" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows one card per subject with its own tutor, price, rating and areas", async () => {
    respondWith(
      jsonResponse(
        page([
          subject(),
          subject({
            id: "subject-physics",
            name: "SAT Physics",
            hourlyRate: "860.00",
            learningAreas: [physics, mathematics],
            rating: null,
            reviewCount: 0,
            classesTaught: 0,
          }),
        ])
      )
    );
    render(<SearchPage />);
    expect(await screen.findByText("2 subjects found")).toBeInTheDocument();

    const calculus = screen.getByRole("link", { name: "A-Level Calculus with Anong Pattana" });
    expect(calculus).toHaveAttribute("href", "/tutors/tutor-anong");
    expect(within(calculus).getByText("Verified")).toBeInTheDocument();
    expect(calculus).toHaveTextContent("★ 4.5 (2 reviews) · 3 classes taught");
    expect(calculus).toHaveTextContent("Limits and derivatives");
    expect(calculus).toHaveTextContent("Mathematics");
    expect(calculus).toHaveTextContent("฿300.00 / hr");
    expect(calculus).not.toHaveTextContent("from");

    // The same tutor's second subject is its own card with its own price.
    const satPhysics = screen.getByRole("link", { name: "SAT Physics with Anong Pattana" });
    expect(satPhysics).toHaveTextContent("New subject");
    expect(satPhysics).toHaveTextContent("PhysicsMathematics");
    expect(satPhysics).toHaveTextContent("฿860.00 / hr");
  });

  it("re-filters immediately and goes back to page 1 when a filter changes", async () => {
    mockParams = new URLSearchParams("sort=rating&page=2");
    respondWith(jsonResponse(page([subject()], { page: 2, totalPages: 2, total: 13 })));
    render(<SearchPage />);
    await screen.findByRole("option", { name: "Physics" });

    fireEvent.change(screen.getByLabelText("Learning area"), { target: { value: "area-physics" } });
    expect(mockReplace).toHaveBeenLastCalledWith(
      "/search?learningAreaId=area-physics&sort=rating",
      {
        scroll: false,
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "4.5 stars and up" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search?minRating=4.5&sort=rating", {
      scroll: false,
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), {
      target: { value: "price_desc" },
    });
    expect(mockReplace).toHaveBeenLastCalledWith("/search?sort=price_desc", { scroll: false });
  });

  it("picks the minimum rating in half stars and clears it when picked again", async () => {
    mockParams = new URLSearchParams("minRating=4");
    respondWith(jsonResponse(page([subject()])));
    render(<SearchPage />);
    await screen.findByText("1 subject found");

    expect(screen.getByText("4.0 and up")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "3.5 stars and up" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search?minRating=3.5", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "4 stars and up" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search", { scroll: false });
  });

  it("sets a price range with two thumbs rounded to the real prices", async () => {
    respondWith(jsonResponse(page([subject()])));
    const { rerender } = render(<SearchPage />);
    await screen.findByText("1 subject found");

    // Real prices ฿75 to ฿860 become a ฿0 to ฿900 slider in ฿10 steps.
    const low = screen.getByLabelText("Minimum price");
    const high = screen.getByLabelText("Maximum price");
    expect(low).toHaveAttribute("min", "0");
    expect(low).toHaveAttribute("max", "900");
    expect(low).toHaveAttribute("step", "10");
    expect(screen.getByText("฿0 to ฿900 / hr")).toBeInTheDocument();

    jest.useFakeTimers();
    fireEvent.change(low, { target: { value: "200" } });
    fireEvent.change(high, { target: { value: "650" } });
    expect(screen.getByText("฿200 to ฿650 / hr")).toBeInTheDocument();
    // The thumbs can't cross.
    fireEvent.change(low, { target: { value: "800" } });
    expect(screen.getByText("฿650 to ฿650 / hr")).toBeInTheDocument();
    fireEvent.change(low, { target: { value: "200" } });
    act(() => jest.advanceTimersByTime(300));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/search?minPrice=200&maxPrice=650", {
      scroll: false,
    });

    // Back at the ends, the range stops limiting the price.
    mockParams = new URLSearchParams("minPrice=200&maxPrice=650");
    rerender(<SearchPage />);
    fireEvent.change(low, { target: { value: "0" } });
    fireEvent.change(high, { target: { value: "900" } });
    act(() => jest.advanceTimersByTime(300));
    expect(mockReplace).toHaveBeenLastCalledWith("/search", { scroll: false });
  });

  it("rounds the slider to thousands once prices pass ฿10,000", async () => {
    priceRange = { min: "1500.00", max: "12400.00" };
    respondWith(jsonResponse(page([subject()])));
    render(<SearchPage />);
    await screen.findByText("1 subject found");
    expect(screen.getByText("฿1,000 to ฿13,000 / hr")).toBeInTheDocument();
    expect(screen.getByLabelText("Maximum price")).toHaveAttribute("step", "100");
  });

  it("waits for typing to pause before searching by keyword or tutor name", async () => {
    respondWith(jsonResponse(page([subject()])));
    render(<SearchPage />);
    await screen.findByText("1 subject found");

    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "cal" } });
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "calculus " } });
    fireEvent.change(screen.getByLabelText("Tutor name"), { target: { value: "anong" } });
    act(() => jest.advanceTimersByTime(299));
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/search?q=calculus&tutorName=anong", {
      scroll: false,
    });
  });

  it("keeps a filter picked while the keyword is still waiting to apply", async () => {
    respondWith(jsonResponse(page([subject()])));
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
    mockParams = new URLSearchParams(
      "q=quantum&tutorName=zed&learningAreaId=area-math&minPrice=100&maxPrice=200&minRating=4.5"
    );
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

    fireEvent.click(screen.getByRole("button", { name: "Remove the price range" }));
    expect(mockReplace).toHaveBeenLastCalledWith(
      "/search?q=quantum&tutorName=zed&learningAreaId=area-math&minRating=4.5",
      { scroll: false }
    );
    fireEvent.click(screen.getByRole("button", { name: 'Any tutor, not just "zed"' }));
    expect(mockReplace).toHaveBeenLastCalledWith(
      "/search?q=quantum&learningAreaId=area-math&minPrice=100&maxPrice=200&minRating=4.5",
      { scroll: false }
    );
    fireEvent.click(screen.getByRole("button", { name: "Any rating" }));
    expect(mockReplace).toHaveBeenLastCalledWith(
      "/search?q=quantum&tutorName=zed&learningAreaId=area-math&minPrice=100&maxPrice=200",
      { scroll: false }
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search", { scroll: false });
  });

  it("clears the new filters too with Clear filters", async () => {
    mockParams = new URLSearchParams("tutorName=anong&minPrice=200&minRating=4&sort=rating");
    respondWith(jsonResponse(page([subject()])));
    render(<SearchPage />);
    await screen.findByText("1 subject found");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/search?sort=rating", { scroll: false });
  });

  it("says no tutors are listed yet when there are no filters to broaden", async () => {
    priceRange = null;
    respondWith(jsonResponse(page([])));
    render(<SearchPage />);
    expect(
      await screen.findByText("No tutors are listed yet. Check back soon.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Minimum price")).not.toBeInTheDocument();
  });

  it("loads the price range once, not on every search", async () => {
    respondWith(jsonResponse(page([subject()])));
    const { rerender } = render(<SearchPage />);
    await screen.findByText("1 subject found");
    mockParams = new URLSearchParams("q=calculus");
    rerender(<SearchPage />);
    await waitFor(() => expect(searchCalls()).toHaveLength(2));
    const rangeCalls = fetchMock.mock.calls.filter(
      ([path]) => path === "/api/discovery/price-range"
    );
    expect(rangeCalls).toHaveLength(1);
  });

  it("goes to the last page when the URL points past the end", async () => {
    mockParams = new URLSearchParams("q=math&page=99");
    respondWith(jsonResponse(page([], { page: 99, total: 30, totalPages: 3 })));
    render(<SearchPage />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/search?q=math&page=3", { scroll: false })
    );
    expect(screen.queryByText("No tutors match these filters")).not.toBeInTheDocument();
  });

  it("gives each half star a tap target of at least 24px", async () => {
    respondWith(jsonResponse(page([subject()])));
    render(<SearchPage />);
    await screen.findByText("1 subject found");
    // Each star is 48px (h-12 w-12) and every button covers half of it.
    const half = screen.getByRole("button", { name: "2.5 stars and up" });
    expect(half.parentElement).toHaveClass("h-12", "w-12");
    expect(half).toHaveClass("w-1/2", "inset-y-0");
  });

  it("pages through results", async () => {
    mockParams = new URLSearchParams("q=math&page=2");
    respondWith(jsonResponse(page([subject()], { page: 2, totalPages: 3, total: 30 })));
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
      jsonResponse(page([subject()]))
    );
    render(<SearchPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("link", { name: "A-Level Calculus with Anong Pattana" })
    ).toBeInTheDocument();
    await waitFor(() => expect(searchCalls()).toHaveLength(2));
  });
});
