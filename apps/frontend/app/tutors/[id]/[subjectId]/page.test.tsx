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
  fetchMock.mockImplementation((path: string) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () =>
        path.includes("/availability")
          ? {
              subject: {
                ...subjectPage().subject,
                tutor: { id: TUTOR_ID, name: "Anong Pattanakul" },
              },
              slots: subjectPage().openSlots.map((startedAt) => ({ id: startedAt, startedAt })),
            }
          : body,
    })
  );
}

const findDayCalendar = () => screen.findByRole("region", { name: "Booking calendar" });

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  mockSearchParams = new URLSearchParams();
  global.fetch = fetchMock;
  localStorage.clear();
});

it("shows only this subject's details, rate, format and reviews, with a way back to the tutor", async () => {
  respond(subjectPage());
  render(<TutorSubjectPage />);

  expect(await screen.findByRole("heading", { level: 1, name: "Calculus" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /With Anong Pattanakul/ })).toBeInTheDocument();
  expect(screen.getByText("฿500.00")).toBeInTheDocument();
  expect(screen.getByText("Online")).toBeInTheDocument();
  expect(screen.getByText("Limits and derivatives")).toBeInTheDocument();
  const reviews = screen.getByRole("region", { name: "Reviews (2)" });
  expect(within(reviews).getByText("Clear explanations.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /With Anong Pattanakul/ })).toHaveAttribute(
    "href",
    `/tutors/${TUTOR_ID}`
  );
  expect(fetchMock).toHaveBeenCalledWith(apiPath, expect.anything());
});

it("offers all 48 half-hours for interactive booking", async () => {
  respond(subjectPage({ openSlots: [at(day, "09:00"), at(day, "09:30"), at(day, "14:00")] }));
  render(<TutorSubjectPage />);
  const calendar = await findDayCalendar();
  expect(within(calendar).getAllByRole("button", { name: /^\d\d:\d\d / })).toHaveLength(48);
  fireEvent.click(within(calendar).getByRole("button", { name: "09:00 Available" }));
  expect(screen.getByRole("button", { name: "Continue to payment" })).toBeEnabled();
  expect(screen.getByText("30 min lesson")).toBeInTheDocument();
  expect(screen.getByText("฿250.00")).toBeInTheDocument();
  expect(screen.getAllByRole("meter")).toHaveLength(5);
});

it("sends a signed-in viewer's token and offers Flag on the subject's comments", async () => {
  localStorage.setItem("authToken", "member-token");
  respond(subjectPage());
  render(<TutorSubjectPage />);

  expect(await screen.findByRole("button", { name: "Flag review by Bob S." })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(apiPath, {
    headers: { Authorization: "Bearer member-token" },
    signal: expect.anything(),
  });
});

it("keeps the calendar visible on an empty day and lets an open day be chosen", async () => {
  respond(subjectPage({ openSlots: [] }));
  render(<TutorSubjectPage />);
  await findDayCalendar();
  expect(screen.getByRole("button", { name: "Continue to payment" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "09:00 Not available" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: otherDay }));
  expect(mockReplace).toHaveBeenCalledWith(`/tutors/${TUTOR_ID}/${SUBJECT_ID}?date=${otherDay}`, {
    scroll: false,
  });
});

it("loads the day named in the URL and ignores a malformed one", async () => {
  mockSearchParams = new URLSearchParams({ date: otherDay });
  respond(subjectPage({ date: otherDay, openSlots: [] }));
  const view = render(<TutorSubjectPage />);
  await findDayCalendar();
  expect(fetchMock).toHaveBeenCalledWith(`${apiPath}?date=${otherDay}`, expect.anything());
  view.unmount();

  mockSearchParams = new URLSearchParams({ date: "tomorrow" });
  render(<TutorSubjectPage />);
  await findDayCalendar();
  expect(fetchMock).toHaveBeenCalledWith(apiPath, expect.anything());
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
