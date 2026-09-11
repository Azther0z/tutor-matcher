import { nextContinuousSelection } from "./continuous-slot-picker";

const slots = [
  { id: "one", startedAt: "2030-01-10T15:30:00.000Z" },
  { id: "two", startedAt: "2030-01-10T16:00:00.000Z" },
  { id: "three", startedAt: "2030-01-10T16:30:00.000Z" },
  { id: "midnight", startedAt: "2030-01-10T17:00:00.000Z" },
];

describe("continuous slot selection", () => {
  it("extends a selection only from either endpoint", () => {
    expect(nextContinuousSelection(slots, ["two"], "three", undefined, "Asia/Bangkok").ids).toEqual(
      ["two", "three"]
    );
    expect(
      nextContinuousSelection(slots, ["two", "three"], "one", undefined, "Asia/Bangkok").ids
    ).toEqual(["one", "two", "three"]);
  });

  it("keeps the block intact when an interior slot is removed", () => {
    const result = nextContinuousSelection(
      slots,
      ["one", "two", "three"],
      "two",
      undefined,
      "Asia/Bangkok"
    );
    expect(result.ids).toEqual(["one", "two", "three"]);
    expect(result.message).toMatch(/first or last/i);
  });

  it("starts a new block for non-adjacent times", () => {
    const result = nextContinuousSelection(slots, ["one"], "three", undefined, "Asia/Bangkok");
    expect(result.ids).toEqual(["three"]);
    expect(result.message).toMatch(/consecutive/i);
  });

  it("does not join 23:30 and 00:00 across a Bangkok calendar-day boundary", () => {
    const result = nextContinuousSelection(slots, ["three"], "midnight", undefined, "Asia/Bangkok");
    expect(result.ids).toEqual(["midnight"]);
    expect(result.message).toMatch(/same day/i);
  });
});
