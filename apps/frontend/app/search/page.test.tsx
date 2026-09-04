import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/jest-globals";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import SearchPage from "./page";

const fetchMock = jest.fn<typeof fetch>();

function response(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response);
}

const tutor = {
  tutorId: 1,
  name: "Ada Lovelace",
  bio: "Algebra tutor",
  subjects: [{ id: 1, name: "Mathematics", description: null, hourlyRate: 25 }],
  averageRating: 4.5,
  reviewCount: 4,
  availableSlotCount: 3,
  matchedSlotCount: 2,
  nextAvailableAt: "2099-06-15T10:00:00.000Z",
};

describe("recommendation search", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    window.localStorage.clear();
    window.localStorage.setItem("authToken", "test-token");
  });

  it("renders personalized tutor recommendations", async () => {
    fetchMock.mockReturnValue(response({ rankingMode: "personalized", recommendations: [tutor] }));
    render(<SearchPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument()
    );
    expect(screen.getByText("Mathematics · $25/hour")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows fallback and empty states", async () => {
    fetchMock.mockReturnValue(response({ rankingMode: "fallback", recommendations: [] }));
    render(<SearchPage />);

    await waitFor(() =>
      expect(screen.getByText(/These results use ratings and availability/)).toBeInTheDocument()
    );
    expect(
      screen.getByText("No published tutors have an open lesson slot right now.")
    ).toBeInTheDocument();
  });
});
