import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  },
  {
    id: "english",
    name: "English",
    description: "Speaking",
    hourlyRate: "150.00",
    format: "ONLINE",
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
  view: "week" | "month" = "week"
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
  await screen.findByRole("grid", { name: "Weekly half-hour calendar" });
  return result;
}
function cell(time = "10:00", day = date, state = "Closed") {
  return screen.getByRole("button", { name: `${day} ${time}: ${state}` });
}
function edit(time = "10:00", day = date, state = "Closed") {
  fireEvent.click(cell(time, day, state));
  return within(screen.getByRole("dialog"));
}
function toggle(name = "Mathematics") {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: new RegExp(name) })
  );
}
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "fixture-token");
  jest.spyOn(Date, "now").mockReturnValue(new Date(`${date}T09:00:00+07:00`).getTime());
});
afterEach(() => jest.restoreAllMocks());

it("shows seven dated columns with 48 selectable half-hours, disables past cells and loads one calendar request", async () => {
  await load();
  expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  expect(screen.getAllByRole("gridcell")).toHaveLength(336);
  expect(cell("08:30")).toBeDisabled();
  expect(cell("10:00")).toBeEnabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe(
    "/api/profiles/me/tutor/availability/calendar?from=2030-10-14&to=2030-10-20"
  );
  expect(screen.queryByRole("button", { name: "Save day" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save week" })).not.toBeInTheDocument();
});

it("publishes only the selected slot with shared subjects in one save and retains it after reload", async () => {
  const rendered = await load();
  edit();
  expect(screen.getByRole("button", { name: "Save slot" })).toBeDisabled();
  toggle();
  toggle("English");
  const saved = slot({ subjectIds: ["math", "english"] });
  fetchMock.mockResolvedValueOnce(jsonResponse({ date, slot: saved }));
  fireEvent.click(screen.getByRole("button", { name: "Save slot" }));
  await screen.findByText(`${date} 10:00: slot saved.`);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(cell("10:00", date, "Open")).toHaveTextContent("Mathematics, English");
  expect(cell("11:00")).toBeInTheDocument();
  const [url, options] = fetchMock.mock.calls[1];
  expect(url).toBe(`/api/profiles/me/tutor/availability/${date}/10:00`);
  expect(options.method).toBe("PUT");
  expect(JSON.parse(options.body)).toEqual({
    revision: null,
    isOpen: true,
    subjectIds: ["math", "english"],
  });
  rendered.unmount();
  await load(calendar([saved]));
  const editor = edit("10:00", date, "Open");
  expect(editor.getByRole("button", { name: /Mathematics/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(editor.getByRole("button", { name: /English/ })).toHaveAttribute("aria-pressed", "true");
});

it("summarizes saved slots in the month and opens the clicked date's week", async () => {
  await load(calendar([slot()]));
  fetchMock.mockResolvedValueOnce(jsonResponse(calendar([slot()], date, "month")));
  fireEvent.click(screen.getByRole("button", { name: "month" }));
  const monthDay = await screen.findByRole("button", { name: `View week of ${date}` });
  expect(monthDay).toHaveTextContent("1 open");
  fetchMock.mockResolvedValueOnce(jsonResponse(calendar([slot()])));
  fireEvent.click(monthDay);
  await screen.findByRole("grid");
  expect(screen.getByRole("button", { name: "week" })).toHaveAttribute("aria-pressed", "true");
  expect(cell("10:00", date, "Open")).toBeInTheDocument();
});

it("navigates across year boundaries and allows any future date", async () => {
  await load();
  fetchMock.mockResolvedValueOnce(jsonResponse(calendar([], "2035-01-01")));
  fireEvent.change(screen.getByLabelText("Go to date"), { target: { value: "2035-01-01" } });
  await waitFor(() =>
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/profiles/me/tutor/availability/calendar?from=2035-01-01&to=2035-01-07"
    )
  );
  await screen.findByRole("grid");
  fetchMock.mockResolvedValueOnce(jsonResponse(calendar([], "2034-12-25")));
  fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
  await waitFor(() =>
    expect(fetchMock.mock.calls[2][0]).toBe(
      "/api/profiles/me/tutor/availability/calendar?from=2034-12-25&to=2034-12-31"
    )
  );
  expect(screen.getByLabelText("Go to date")).not.toHaveAttribute("max");
});

it("saves Close slot directly without another day/week save", async () => {
  const original = slot();
  await load(calendar([original]));
  edit("10:00", date, "Open");
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ date, slot: slot({ isOpen: false, revision: "b".repeat(64) }) })
  );
  fireEvent.click(screen.getByRole("button", { name: "Close slot" }));
  await screen.findByText(`${date} 10:00: slot closed.`);
  expect(cell()).toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    revision: original.revision,
    isOpen: false,
    subjectIds: ["math"],
  });
});

it("keeps the slot draft after a network failure, protects navigation and retries", async () => {
  await load();
  edit();
  toggle();
  fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Save slot" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
  expect(screen.getByRole("button", { name: /Mathematics/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(screen.getByLabelText("Go to date")).toBeDisabled();
  fetchMock.mockResolvedValueOnce(jsonResponse({ date, slot: slot() }));
  fireEvent.click(screen.getByRole("button", { name: "Save slot" }));
  await screen.findByText(`${date} 10:00: slot saved.`);
});

it("requires explicit discard on cancel or Escape and restores focus to the cell", async () => {
  await load();
  cell().focus();
  edit();
  toggle();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.getByRole("group", { name: "Confirm discard" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Mathematics/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(cell()).toHaveFocus();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("preserves a stale draft, shows the latest free slot and requires explicit revision adoption before retry", async () => {
  await load();
  edit();
  toggle("English");
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "This slot changed" }, 409));
  fireEvent.click(screen.getByRole("button", { name: "Save slot" }));
  await screen.findByRole("button", { name: "Review latest slot" });
  expect(screen.getByRole("button", { name: "Save slot" })).toBeDisabled();
  fetchMock.mockResolvedValueOnce(jsonResponse({ date, slots: [slot()], subjects }));
  fireEvent.click(screen.getByRole("button", { name: "Review latest slot" }));
  await screen.findByText(/Latest: Open; subjects: Mathematics/);
  expect(screen.getByRole("button", { name: /English/ })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Keep draft with latest revision" }));
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ date, slot: slot({ subjectIds: ["english"], revision: "b".repeat(64) }) })
  );
  fireEvent.click(screen.getByRole("button", { name: "Save slot" }));
  await screen.findByText(`${date} 10:00: slot saved.`);
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
    revision: "a".repeat(64),
    isOpen: true,
    subjectIds: ["english"],
  });
});

it("prevents retrying over a newly held slot while preserving the draft until latest is accepted", async () => {
  await load(calendar([slot()]));
  edit("10:00", date, "Open");
  toggle("English");
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "This slot changed" }, 409));
  fireEvent.click(screen.getByRole("button", { name: "Save slot" }));
  await screen.findByRole("button", { name: "Review latest slot" });
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ date, slots: [slot({ locked: true, revision: "b".repeat(64) })], subjects })
  );
  fireEvent.click(screen.getByRole("button", { name: "Review latest slot" }));
  await screen.findByText(/Latest: Reserved/);
  expect(screen.getByRole("button", { name: "Keep draft with latest revision" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /English/ })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Use latest slot" }));
  expect(screen.getByText("Reserved / booked. This slot cannot be changed.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Close slot" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save slot" })).toBeDisabled();
});

it("shows subject setup and retries access/load failures", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Forbidden" }, 403));
  render(<TutorAvailabilityEditor />);
  expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission");
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...calendar(), subjects: [] }));
  fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
  expect(await screen.findByRole("link", { name: "Tutor settings" })).toHaveAttribute(
    "href",
    "/settings/tutor"
  );
  expect(screen.queryByRole("grid")).not.toBeInTheDocument();
});
