import { fireEvent, render, screen, within } from "@testing-library/react";
import TutorSubjectPage from "./page";
import type { SubjectPage } from "@/src/lib/tutor-profile-api";

const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({
    id: "00000000-0000-4000-8000-000000000002",
    subjectId: "00000000-0000-4000-8000-000000000301",
  }),
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

const TUTOR_ID = "00000000-0000-4000-8000-000000000002";
const SUBJECT_ID = "00000000-0000-4000-8000-000000000301";
const apiPath = `/api/discovery/tutors/${TUTOR_ID}/subjects/${SUBJECT_ID}`;
// Bangkok dates relative to now, so the calendar always treats them as upcoming days.
const bangkokDay = (days: number) =>
  new Date(Date.now() + 7 * 60 * 60 * 1000 + days * 86_400_000).toISOString().slice(0, 10);
const today = bangkokDay(0);
const day = bangkokDay(3);
// Another upcoming day in the same month, so the calendar shows it without navigating.
const otherDay = day.slice(0, 7) === bangkokDay(4).slice(0, 7) ? bangkokDay(4) : bangkokDay(2);
const at = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();

function subjectPage(overrides: Partial<SubjectPage> = {}): SubjectPage {
  return {
    tutor: { id: TUTOR_ID, firstName: "Anong", lastName: "Pattanakul", verified: true },
    subject: {
      id: SUBJECT_ID,
      name: "Calculus",
      description: "Limits and derivatives",
      hourlyRate: "500.00",
      format: "ONLINE",
      learningAreas: [],
      rating: 4.5,
      reviewCount: 2,
      nextOpening: at(day, "09:00"),
    },
    date: day,
    openDates: [day, otherDay],
    openSlots: [at(day, "09:00"), at(day, "09:30")],
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
    ...overrides,
  };
}

function respond(body: unknown, status = 200) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const dayCalendar = () => screen.getByRole("region", { name: /^Calendar for / });
const findDayCalendar = () => screen.findByRole("region", { name: /^Calendar for / });

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  mockSearchParams = new URLSearchParams();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "token");
});

it("shows only this subject's details, rate, format and reviews, with a way back to the tutor", async () => {
  respond(subjectPage());
  render(<TutorSubjectPage />);

  expect(await screen.findByRole("heading", { level: 1, name: "Calculus" })).toBeInTheDocument();
  expect(screen.getByText("with Anong Pattanakul")).toBeInTheDocument();
  expect(screen.getByText("฿500.00")).toBeInTheDocument();
  expect(screen.getByText("Online")).toBeInTheDocument();
  expect(screen.getByText("Limits and derivatives")).toBeInTheDocument();
  const reviews = screen.getByRole("region", { name: "Reviews for Calculus" });
  expect(within(reviews).getByText("Clear explanations.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "← Back to Anong Pattanakul" })).toHaveAttribute(
    "href",
    `/tutors/${TUTOR_ID}`
  );
  expect(fetchMock).toHaveBeenCalledWith(apiPath, expect.anything());
});

it("shows the day as a calendar of all 48 half-hours, with open times drawn as blocks", async () => {
  respond(subjectPage({ openSlots: [at(day, "09:00"), at(day, "09:30"), at(day, "14:00")] }));
  render(<TutorSubjectPage />);

  const calendar = await findDayCalendar();
  expect(within(calendar).getAllByRole("listitem")).toHaveLength(48);
  expect(within(calendar).getByText("09:00–09:30 Available")).toBeInTheDocument();
  expect(within(calendar).getByText("09:30–10:00 Available")).toBeInTheDocument();
  expect(within(calendar).getByText("14:00–14:30 Available")).toBeInTheDocument();
  expect(within(calendar).getByText("00:00–00:30 Not available")).toBeInTheDocument();
  expect(within(calendar).getByText("23:30–24:00 Not available")).toBeInTheDocument();
  expect(within(calendar).getAllByText(/^\d\d:\d\d–\d\d:\d\d Available$/)).toHaveLength(3);
  expect(within(calendar).getAllByText(/ Not available$/)).toHaveLength(45);
  // Consecutive open half-hours read as one block; a lone half-hour is its own block.
  expect(within(calendar).getByText("09:00–10:00 · Available")).toBeInTheDocument();
  expect(within(calendar).getByText("14:00–14:30 · Available")).toBeInTheDocument();
  expect(screen.getByText("Open times: 09:00–10:00, 14:00–14:30")).toBeInTheDocument();
  expect(within(calendar).queryAllByRole("button")).toHaveLength(0);
  expect(within(calendar).queryAllByRole("link")).toHaveLength(0);
});

it("opens the calendar at the first open time", async () => {
  jest.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (
    this: HTMLElement
  ) {
    return this.parentElement ? Array.from(this.parentElement.children).indexOf(this) * 32 : 0;
  });
  respond(subjectPage());
  render(<TutorSubjectPage />);

  // 09:00 is half-hour 18; 08:30 stays in view above it.
  expect((await findDayCalendar()).scrollTop).toBe(17 * 32);
});

it("puts Book this subject below the calendar, carrying the subject and the selected date", async () => {
  respond(subjectPage());
  render(<TutorSubjectPage />);

  const calendar = await findDayCalendar();
  const book = screen.getByRole("link", { name: "Book this subject" });
  expect(book).toHaveAttribute("href", `/bookings/s/${SUBJECT_ID}?date=${day}`);
  expect(calendar.compareDocumentPosition(book) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("sends a logged-out visitor to log in first without losing the date", async () => {
  localStorage.clear();
  respond(subjectPage());
  render(<TutorSubjectPage />);

  expect(await screen.findByRole("link", { name: "Book this subject" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(`/bookings/s/${SUBJECT_ID}?date=${day}`)}`
  );
});

it("disables booking on a day with no open times", async () => {
  respond(subjectPage({ openSlots: [] }));
  render(<TutorSubjectPage />);

  const book = await screen.findByRole("button", { name: "Book this subject" });
  expect(book).toBeDisabled();
  expect(book).toHaveAccessibleDescription(
    "No open times on this day. Pick a day marked with a dot."
  );
  expect(screen.queryByRole("link", { name: "Book this subject" })).not.toBeInTheDocument();
  expect(within(dayCalendar()).getAllByText(/ Not available$/)).toHaveLength(48);
  expect(within(dayCalendar()).queryByText(/· Available$/)).not.toBeInTheDocument();
  expect(screen.getByText("No open times on this day")).toBeInTheDocument();
});

it("lets any upcoming day be picked, marks open days and keeps the day in the URL", async () => {
  respond(subjectPage());
  render(<TutorSubjectPage />);

  expect(await screen.findByRole("button", { name: `${day}, has open times` })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  const month = day.slice(0, 7);
  const dates = Array.from({ length: 31 }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const emptyDay = dates.find((date) => date >= today && date !== day && date !== otherDay)!;
  expect(screen.getByRole("button", { name: emptyDay })).toBeEnabled();
  const pastDay = dates.find((date) => date < today);
  if (pastDay) expect(screen.getByRole("button", { name: pastDay })).toBeDisabled();
  const previousMonth = screen.getByRole("button", { name: "Previous month" });
  if (day.slice(0, 7) === today.slice(0, 7)) expect(previousMonth).toBeDisabled();
  else expect(previousMonth).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: `${otherDay}, has open times` }));
  expect(mockReplace).toHaveBeenCalledWith(`/tutors/${TUTOR_ID}/${SUBJECT_ID}?date=${otherDay}`, {
    scroll: false,
  });
});

it("loads the day named in the URL and ignores a malformed one", async () => {
  mockSearchParams = new URLSearchParams({ date: otherDay });
  respond(subjectPage({ date: otherDay, openSlots: [] }));
  const view = render(<TutorSubjectPage />);
  await findDayCalendar();
  expect(fetchMock).toHaveBeenLastCalledWith(`${apiPath}?date=${otherDay}`, expect.anything());
  view.unmount();

  mockSearchParams = new URLSearchParams({ date: "tomorrow" });
  render(<TutorSubjectPage />);
  await findDayCalendar();
  expect(fetchMock).toHaveBeenLastCalledWith(apiPath, expect.anything());
});

it("shows only an unavailable message when the subject is not public", async () => {
  respond({ message: "This subject is unavailable" }, 404);
  render(<TutorSubjectPage />);

  expect(
    await screen.findByRole("heading", { name: "This subject is unavailable" })
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Find a tutor" })).toHaveAttribute("href", "/search");
  expect(screen.queryByRole("region", { name: /^Calendar for / })).not.toBeInTheDocument();
});

it("offers a retry when the subject cannot be loaded", async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => subjectPage() });
  render(<TutorSubjectPage />);

  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Calculus" })).toBeInTheDocument();
});
