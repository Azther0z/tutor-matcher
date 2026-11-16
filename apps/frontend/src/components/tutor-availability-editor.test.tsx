import { fireEvent, render, screen, within } from "@testing-library/react";
import { TutorAvailabilityEditor } from "./tutor-availability-editor";
import { jsonResponse } from "@/src/test/tutor-profile-fixtures";
import { calendarDates, type AvailabilityCalendar, type StoredSlot } from "@/src/lib/availability";

const fetchMock = jest.fn();
const date = "2030-10-15";
const subjects: AvailabilityCalendar["subjects"] = [
  {
    id: "math",
    name: "Mathematics",
    description: "Algebra",
    hourlyRate: "200.00",
    format: "ONLINE",
    learningAreas: [],
  },
  {
    id: "english",
    name: "English",
    description: "Speaking",
    hourlyRate: "150.00",
    format: "ONLINE",
    learningAreas: [],
  },
];
function slot(overrides: Partial<StoredSlot> = {}): StoredSlot {
  return {
    id: "slot",
    time: "10:00",
    isOpen: true,
    subjectIds: ["math"],
    locked: false,
    revision: "a".repeat(64),
    ...overrides,
  };
}
function calendar(
  slots: StoredSlot[] = [],
  anchor = date,
  view: "week" | "month" = "month"
): AvailabilityCalendar {
  return {
    timeZone: "Asia/Bangkok",
    subjects,
    days: calendarDates(anchor, view).map((day) => ({
      date: day,
      slots: day === date ? slots : [],
    })),
  };
}
async function load(value = calendar()) {
  fetchMock.mockResolvedValueOnce(jsonResponse(value));
  const result = render(<TutorAvailabilityEditor />);
  await screen.findByRole("button", { name: "Select time 10:00" });
  return result;
}
function choosePeriod() {
  fireEvent.click(screen.getByRole("button", { name: "Select time 10:00" }));
  const popup = within(screen.getByRole("dialog", { name: "Edit subjects in selected slots" }));
  fireEvent.change(popup.getByLabelText("Selection end"), { target: { value: "22" } });
  fireEvent.click(popup.getByRole("checkbox", { name: "Mathematics" }));
  return popup;
}
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "fixture-token");
  jest.spyOn(Date, "now").mockReturnValue(new Date(`${date}T09:00:00+07:00`).getTime());
});
afterEach(() => jest.restoreAllMocks());

it("opens a period checklist from a time without saving until Add", async () => {
  await load();
  expect(screen.getByRole("button", { name: "Select time 08:30" })).toBeDisabled();
  const popup = choosePeriod();
  expect(popup.getByRole("checkbox", { name: "English" })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(popup.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("adds several subjects over a period using one save per half-hour", async () => {
  await load();
  const popup = choosePeriod();
  fireEvent.click(popup.getByRole("checkbox", { name: "English" }));
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ date, slot: slot({ subjectIds: ["math", "english"] }) }))
    .mockResolvedValueOnce(
      jsonResponse({ date, slot: slot({ time: "10:30", subjectIds: ["math", "english"] }) })
    );
  fireEvent.click(popup.getByRole("button", { name: "Apply" }));
  await screen.findByText("2 half-hour slots updated.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mathematics, 10:00–10:30" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "English, 10:00–10:30" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mathematics, 10:30–11:00" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "English, 10:30–11:00" })).toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    revision: null,
    isOpen: true,
    subjectIds: ["math", "english"],
  });
  expect(fetchMock.mock.calls[2][0]).toContain("/10:30");
});

it("shows fully checked subjects and removes them through the checklist", async () => {
  await load(calendar([slot({ subjectIds: ["math", "english"] })]));
  fireEvent.click(screen.getByRole("button", { name: "Mathematics, 10:00–10:30" }));
  const popup = within(screen.getByRole("dialog"));
  expect(popup.getByRole("checkbox", { name: "Mathematics" })).toBeChecked();
  expect(popup.getByRole("checkbox", { name: "English" })).toBeChecked();
  expect(popup.getByRole("button", { name: "Apply" })).toBeDisabled();
  fireEvent.click(popup.getByRole("checkbox", { name: "Mathematics" }));
  fetchMock.mockResolvedValueOnce(jsonResponse({ date, slot: slot({ subjectIds: ["english"] }) }));
  fireEvent.click(popup.getByRole("button", { name: "Apply" }));
  await screen.findByText("1 half-hour slot updated.");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
    isOpen: true,
    subjectIds: ["english"],
  });
});

it("shows mixed subjects, clears all on first click and checks all on the next click", async () => {
  await load(calendar([slot()]));
  fireEvent.click(screen.getByRole("button", { name: "Select time 10:00" }));
  const popup = within(screen.getByRole("dialog"));
  fireEvent.change(popup.getByLabelText("Selection end"), { target: { value: "22" } });
  const checkbox = popup.getByRole("checkbox", { name: "Mathematics" });
  expect(checkbox).toBePartiallyChecked();
  expect(popup.getByText("Mixed")).toBeInTheDocument();
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();
  expect(checkbox).not.toBePartiallyChecked();
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();
  expect(checkbox).not.toBePartiallyChecked();
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ date, slot: slot({ isOpen: false, subjectIds: [] }) })
  );
  fireEvent.click(popup.getByRole("button", { name: "Apply" }));
  await screen.findByText("1 half-hour slot updated.");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
    isOpen: false,
    subjectIds: [],
  });
});

it("leaves untouched mixed subjects unchanged and removes the right-click menu", async () => {
  await load(calendar([slot()]));
  const row = screen.getByRole("button", { name: "Mathematics, 10:00–10:30" });
  fireEvent.contextMenu(row);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Select time 10:00" }));
  const popup = within(screen.getByRole("dialog"));
  fireEvent.change(popup.getByLabelText("Selection end"), { target: { value: "22" } });
  fireEvent.click(popup.getByRole("checkbox", { name: "English" }));
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ date, slot: slot({ subjectIds: ["math", "english"] }) }))
    .mockResolvedValueOnce(
      jsonResponse({ date, slot: slot({ time: "10:30", subjectIds: ["english"] }) })
    );
  fireEvent.click(popup.getByRole("button", { name: "Apply" }));
  await screen.findByText("2 half-hour slots updated.");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).subjectIds).toEqual(["math", "english"]);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).subjectIds).toEqual(["english"]);
});

it("keeps the selected period and checked subjects after partial failure", async () => {
  await load();
  const popup = choosePeriod();
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ date, slot: slot() }))
    .mockRejectedValueOnce(new Error("Network unavailable"))
    .mockResolvedValueOnce(
      jsonResponse({ date, slots: [slot()], subjects, timeZone: "Asia/Bangkok" })
    );
  fireEvent.click(popup.getByRole("button", { name: "Apply" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("1 slots saved");
  expect(popup.getByRole("checkbox", { name: "Mathematics" })).toBeChecked();
  expect(screen.getByRole("button", { name: "Mathematics, 10:00–10:30" })).toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(jsonResponse({ date, slot: slot({ time: "10:30" }) }));
  fireEvent.click(popup.getByRole("button", { name: "Apply" }));
  await screen.findByText("1 half-hour slot updated.");
  expect(fetchMock.mock.calls[4][0]).toContain("/10:30");
});

it("keeps booked rows and time slots uneditable", async () => {
  await load(calendar([slot({ locked: true })]));
  expect(screen.getByRole("button", { name: "Select time 10:00" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Mathematics, 10:00–10:30" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("adds to existing subjects without replacing their assignments", async () => {
  await load(calendar([slot({ subjectIds: ["english"] })]));
  fireEvent.click(screen.getByRole("button", { name: "Select time 10:00" }));
  const popup = within(screen.getByRole("dialog"));
  fireEvent.click(popup.getByRole("checkbox", { name: "Mathematics" }));
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ date, slot: slot({ subjectIds: ["english", "math"] }) })
  );
  fireEvent.click(popup.getByRole("button", { name: "Apply" }));
  await screen.findByText("1 half-hour slot updated.");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).subjectIds).toEqual(["english", "math"]);
});

it("dragging across half-hours previews a period and opens the adjacent checklist", async () => {
  await load();
  const original = window.PointerEvent;
  Object.defineProperty(window, "PointerEvent", { configurable: true, value: MouseEvent });
  const track = screen.getByRole("group", { name: "Select availability slots" });
  Object.defineProperty(track, "setPointerCapture", { configurable: true, value: jest.fn() });
  Object.defineProperty(track, "hasPointerCapture", { configurable: true, value: () => false });
  track.querySelectorAll<HTMLElement>("[data-slot-index]").forEach((cell, index) => {
    const left = (index % 12) * 80,
      top = Math.floor(index / 12) * 96;
    jest.spyOn(cell, "getBoundingClientRect").mockReturnValue({
      left,
      top,
      right: left + 80,
      bottom: top + 96,
      width: 80,
      height: 96,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
  });
  try {
    fireEvent.pointerDown(track, { button: 0, clientX: 650, clientY: 106 });
    fireEvent.pointerMove(track, { clientX: 890, clientY: 106 });
    fireEvent.pointerUp(track, { button: 0, clientX: 890, clientY: 106 });
    const popup = within(
      await screen.findByRole("dialog", { name: "Edit subjects in selected slots" })
    );
    expect(popup.getByLabelText("Selection start")).toHaveValue("20");
    expect(popup.getByLabelText("Selection end")).toHaveValue("24");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(window, "PointerEvent", { configurable: true, value: original });
  }
});

it("creates five separate rows per subject when five slots are selected", async () => {
  await load();
  const popup = choosePeriod();
  fireEvent.change(popup.getByLabelText("Selection end"), { target: { value: "25" } });
  fireEvent.click(popup.getByRole("checkbox", { name: "English" }));
  for (const time of ["10:00", "10:30", "11:00", "11:30", "12:00"]) {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ date, slot: slot({ time, subjectIds: ["math", "english"] }) })
    );
  }
  fireEvent.click(popup.getByRole("button", { name: "Apply" }));
  await screen.findByText("5 half-hour slots updated.");
  expect(screen.getAllByRole("button", { name: /^(Mathematics|English), / })).toHaveLength(10);
  expect(fetchMock).toHaveBeenCalledTimes(6);
});

it("shows at most two subject rows per fixed-height slot and opens all subjects from the overflow", async () => {
  const value = calendar([slot({ subjectIds: ["math", "english", "science", "art"] })]);
  value.subjects = [
    ...subjects,
    { ...subjects[0], id: "science", name: "Science" },
    { ...subjects[0], id: "art", name: "Art" },
  ];
  await load(value);
  expect(screen.queryByRole("button", { name: "Science, 10:00–10:30" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Art, 10:00–10:30" })).not.toBeInTheDocument();
  const more = screen.getByRole("button", { name: "Show 2 more subjects at 10:00" });
  expect(more).toHaveTextContent("...");
  fireEvent.click(more);
  const popup = within(screen.getByRole("dialog"));
  expect(popup.getByRole("checkbox", { name: "Art" })).toBeChecked();
  expect(popup.getAllByRole("checkbox")).toHaveLength(4);
});

it("navigates adjacent days without refetching the same month", async () => {
  await load();
  expect(screen.queryByRole("button", { name: "Previous day" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: date })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "2030-10-16" }));
  expect(screen.getByRole("button", { name: "2030-10-16" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(screen.queryByRole("button", { name: "Next day" })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("centers the selected day between three past and three future dates", async () => {
  await load();
  const strip = screen.getByLabelText("Nearby days");
  expect(within(strip).getAllByRole("button")).toHaveLength(7);
  expect(within(strip).getAllByRole("button")[3]).toHaveAttribute("aria-label", date);
  expect(screen.getByRole("button", { name: "2030-10-14" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "2030-10-18" }));
  const updated = within(screen.getByLabelText("Nearby days")).getAllByRole("button");
  expect(updated).toHaveLength(7);
  expect(updated[0]).toHaveAttribute("aria-label", date);
  expect(updated[3]).toHaveAttribute("aria-label", "2030-10-18");
  expect(updated[3]).toHaveAttribute("aria-pressed", "true");
  expect(updated[6]).toHaveAttribute("aria-label", "2030-10-21");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
