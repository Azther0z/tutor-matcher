import { render, screen } from "@testing-library/react";
import { TutorNeedsConfirmation } from "./tutor-needs-confirmation";

const endedClass = {
  id: "f0f21183-1af0-49a9-b35f-63d9431b2748",
  status: "CONFIRMED",
  viewerRole: "TUTOR",
  startedAt: "2030-01-10T09:00:00.000Z",
  endedAt: "2030-01-10T09:30:00.000Z",
  student: { id: "b4111412-59e8-449f-8f1a-f2fb858bd90d", name: "Student One" },
  subject: { id: "8f2dc6e2-27f8-4e7f-bd7f-f553e42bd05b", name: "English" },
};

beforeEach(() => localStorage.setItem("authToken", "tutor-token"));
afterEach(() => localStorage.clear());

it("lists ended lessons and links to the booking detail", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ bookings: [endedClass] }),
  });
  render(<TutorNeedsConfirmation />);

  expect(await screen.findByText("Needs confirmation")).toBeInTheDocument();
  expect(await screen.findByText("English")).toBeInTheDocument();
  expect(screen.getByText("with Student One")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review lesson" })).toHaveAttribute(
    "href",
    `/bookings/${endedClass.id}`
  );
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/bookings/tutor/needs-confirmation",
    expect.objectContaining({ headers: { Authorization: "Bearer tutor-token" } })
  );
});

it("shows the empty state and reports a loading error", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ bookings: [] }) });
  const { unmount } = render(<TutorNeedsConfirmation />);
  expect(await screen.findByText("No lessons need confirmation.")).toBeInTheDocument();
  unmount();

  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ message: "Only approved Tutors can view lessons needing confirmation" }),
  });
  render(<TutorNeedsConfirmation />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Only approved Tutors");
});
