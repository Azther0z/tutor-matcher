import { describe, expect, it } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client.ts";
import { createBookingSchema } from "./booking.schema.ts";
import { cancellationRefund } from "./booking.service.ts";

describe("trial booking rules", () => {
  it("rejects duplicate slots before creating a booking", () => {
    expect(
      createBookingSchema.safeParse({ subjectId: 1, availabilityIds: [2, 2], isTrial: true })
        .success
    ).toBe(false);
  });

  it("refunds the full credit more than 24 hours before the lesson", () => {
    const result = cancellationRefund(
      new Prisma.Decimal("100.00"),
      new Date("2026-09-07T01:00:01Z"),
      new Date("2026-09-06T01:00:00Z")
    );
    expect(result.late).toBe(false);
    expect(result.amount.toString()).toBe("100");
  });

  it("refunds 70 percent at exactly 24 hours or less", () => {
    const result = cancellationRefund(
      new Prisma.Decimal("100.00"),
      new Date("2026-09-07T01:00:00Z"),
      new Date("2026-09-06T01:00:00Z")
    );
    expect(result.late).toBe(true);
    expect(result.amount.toString()).toBe("70");
  });
});
