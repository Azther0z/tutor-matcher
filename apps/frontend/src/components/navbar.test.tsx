import { render, screen, waitFor } from "@testing-library/react";
import { Navbar } from "./navbar";

const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: jest.fn() }),
}));

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
});

describe("Navbar", () => {
  it("shows Become a tutor for a logged-out visitor", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Become a tutor" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows Become a tutor for a logged-in user who is not an approved Tutor", async () => {
    localStorage.setItem("authToken", "test-token");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "NONE", tutor: null }) });

    render(<Navbar />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("link", { name: "Become a tutor" })).toBeInTheDocument();
  });

  it("hides Become a tutor for an approved Tutor", async () => {
    localStorage.setItem("authToken", "test-token");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "APPROVED", tutor: null }),
    });

    render(<Navbar />);

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Become a tutor" })).not.toBeInTheDocument()
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profiles/me/tutor",
      expect.objectContaining({ headers: { Authorization: "Bearer test-token" } })
    );
  });
});
