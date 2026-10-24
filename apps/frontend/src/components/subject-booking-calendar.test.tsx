import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { SubjectBookingCalendar } from "./subject-booking-calendar";

beforeEach(() => jest.useFakeTimers({ now: new Date("2030-01-10T02:00:00Z") }));
afterEach(() => jest.useRealTimers());

function Fixture() {
  const [ids, setIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <SubjectBookingCalendar
        slots={[
          { id: "past", startedAt: "2030-01-09T03:00:00Z" },
          { id: "a", startedAt: "2030-01-10T03:00:00Z" },
          { id: "b", startedAt: "2030-01-10T03:30:00Z" },
          { id: "c", startedAt: "2030-01-10T05:00:00Z" },
          { id: "next", startedAt: "2030-01-11T03:00:00Z" },
          { id: "beyond", startedAt: "2030-04-11T03:00:00Z" },
        ]}
        selectedIds={ids}
        onChange={setIds}
        onSelectionMessage={setMessage}
      />
      <output aria-label="Selected IDs">{ids.join(",")}</output>
      <p>{message}</p>
    </>
  );
}

it("selects only open times in a continuous block and clears selection on day change", () => {
  render(<Fixture />);
  expect(screen.getByRole("button", { name: "2030-01-09" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "2030-01-10" }));
  fireEvent.click(screen.getByRole("button", { name: "10:00 Available" }));
  fireEvent.click(screen.getByRole("button", { name: "10:30 Available" }));
  expect(screen.getByLabelText("Selected IDs")).toHaveTextContent("a,b");
  fireEvent.click(screen.getByRole("button", { name: "12:00 Available" }));
  expect(screen.getByLabelText("Selected IDs")).toHaveTextContent(/^c$/);
  expect(screen.getByText(/Times must be consecutive/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "2030-01-11" }));
  expect(screen.getByLabelText("Selected IDs")).toBeEmptyDOMElement();
});

it("limits calendar navigation and selection to three months ahead", () => {
  render(<Fixture />);
  expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(screen.getByText("April 2030")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "2030-04-11" })).toBeDisabled();
});
