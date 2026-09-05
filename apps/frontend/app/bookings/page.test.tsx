import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BookingsPage from "./page";

const replace = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const bookings = [
  {
    id: 7,
    status: "PENDING_PAYMENT",
    isTrial: true,
    totalAmount: "75",
    startedAt: "2099-09-11T10:00:00.000Z",
    endedAt: "2099-09-11T10:30:00.000Z",
    subject: {
      id: 1,
      name: "Mathematics",
      hourlyRate: "150",
      tutor: { id: 1, name: "Alice Johnson" },
    },
    availabilities: [],
  },
];

describe("bookings list", () => {
  beforeEach(() => {
    localStorage.setItem("authToken", "token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bookings }),
    }) as jest.Mock;
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("shows the student's bookings and filters payment due lessons", async () => {
    render(<BookingsPage />);
    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Payment due" }));
    expect(screen.getByRole("link", { name: /Mathematics/ })).toHaveAttribute(
      "href",
      "/bookings/7"
    );
  });

  it("redirects guests to login and preserves the booking-list URL", async () => {
    localStorage.clear();
    render(<BookingsPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fbookings"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
