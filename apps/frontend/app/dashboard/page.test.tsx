import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";

const mockPush = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  mockPush.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

describe("DashboardPage", () => {
  it("shows the onboarding prompt when the Student profile is missing", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValue({ status: 404, ok: false });

    render(<DashboardPage />);

    expect(await screen.findByText("Complete your Student profile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue onboarding" })).toHaveAttribute(
      "href",
      "/onboarding/student"
    );
  });

  it("does not show the onboarding prompt when the Student profile exists", async () => {
    localStorage.setItem("authToken", "student-token");
    fetchMock.mockResolvedValue({ status: 200, ok: true });

    render(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText("Your Student profile is ready")).toBeInTheDocument()
    );
    expect(screen.queryByText("Complete your Student profile")).not.toBeInTheDocument();
  });
});
