import { beforeEach, expect, it, jest } from "@jest/globals";

const findExpired = jest.fn<(...args: unknown[]) => Promise<Array<{ id: string }>>>();
const cancelExpired = jest.fn<(...args: unknown[]) => Promise<{ count: number }>>();
const releaseSlots = jest.fn<(...args: unknown[]) => Promise<{ count: number }>>();
const tx = {
  booking: { findMany: findExpired, updateMany: cancelExpired },
  availability: { updateMany: releaseSlots },
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  },
}));

const { releaseExpiredBookings } = await import("./booking.expiry.ts");

beforeEach(() => {
  findExpired.mockReset();
  cancelExpired.mockReset();
  releaseSlots.mockReset();
});

it("skips writes when no payment holds expired", async () => {
  findExpired.mockResolvedValue([]);

  await expect(releaseExpiredBookings()).resolves.toBe(0);
  expect(cancelExpired).not.toHaveBeenCalled();
  expect(releaseSlots).not.toHaveBeenCalled();
});

it("cancels and releases an expiry batch with two writes", async () => {
  const now = new Date("2026-10-29T10:00:00.000Z");
  findExpired.mockResolvedValue([{ id: "booking-a" }, { id: "booking-b" }]);
  cancelExpired.mockResolvedValue({ count: 2 });
  releaseSlots.mockResolvedValue({ count: 3 });

  await expect(releaseExpiredBookings(now, { userId: "student-a" })).resolves.toBe(2);
  expect(cancelExpired).toHaveBeenCalledTimes(1);
  expect(cancelExpired).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ id: { in: ["booking-a", "booking-b"] } }),
      data: expect.objectContaining({ status: "CANCELLED", cancelledAt: now }),
    })
  );
  expect(releaseSlots).toHaveBeenCalledTimes(1);
  expect(releaseSlots).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ bookingId: { in: ["booking-a", "booking-b"] } }),
      data: { bookingId: null },
    })
  );
});
