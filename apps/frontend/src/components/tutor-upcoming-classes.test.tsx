import { render, screen } from "@testing-library/react";
import { TutorUpcomingClasses } from "./tutor-upcoming-classes";

const upcomingClass = {
  id: "f0f21183-1af0-49a9-b35f-63d9431b2748",
  status: "CONFIRMED",
  viewerRole: "TUTOR",
  startedAt: "2030-01-10T09:00:00.000Z",
  student: { id: "b4111412-59e8-449f-8f1a-f2fb858bd90d", name: "Student One" },
  subject: { id: "8f2dc6e2-27f8-4e7f-bd7f-f553e42bd05b", name: "English" },
};

beforeEach(() => localStorage.setItem("authToken", "tutor-token"));
afterEach(() => localStorage.clear());

it("lists each upcoming class with its student and links to the booking", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      bookings: [
        upcomingClass,
        { ...upcomingClass, id: "2c0f4d8e-1111-4111-8111-111111111111", status: "PENDING_PAYMENT" },
      ],
    }),
  });
  render(<TutorUpcomingClasses />);
  const links = await screen.findAllByRole("link");
  expect(links[0]).toHaveAttribute("href", `/bookings/${upcomingClass.id}`);
  expect(screen.getAllByText("with Student One")).toHaveLength(2);
  expect(screen.getByText("Confirmed")).toBeInTheDocument();
  expect(screen.getByText("Payment due")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/bookings/tutor/upcoming",
    expect.objectContaining({ headers: { Authorization: "Bearer tutor-token" } })
  );
});

it("shows an empty state and an error state", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ bookings: [] }) });
  const { unmount } = render(<TutorUpcomingClasses />);
  expect(await screen.findByText("No upcoming classes.")).toBeInTheDocument();
  unmount();

  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ message: "Only approved Tutors can view their classes" }),
  });
  render(<TutorUpcomingClasses />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Only approved Tutors");
});
