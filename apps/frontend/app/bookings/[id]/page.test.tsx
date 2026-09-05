import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BookingDetailPage from "./page";

const replace = jest.fn();
const router = { replace };
jest.mock("next/navigation", () => ({ useParams: () => ({ id: "44" }), useRouter: () => router }));

const booking = {
  id: 44,
  status: "CONFIRMED",
  isTrial: true,
  totalAmount: 10,
  subject: { id: 12, name: "English", hourlyRate: 20, tutor: { id: 3, name: "Alice" } },
  availabilities: [{ id: 101, startedAt: "2030-01-10T09:00:00.000Z" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("authToken", "student-token");
});

it("shows the no-penalty policy and cancels the booking", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => booking })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...booking, status: "CANCELLED" }) });
  render(<BookingDetailPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel lesson" }));
  expect(screen.getByText(/without penalty/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await waitFor(() => expect(screen.getByText("CANCELLED")).toBeInTheDocument());
});
