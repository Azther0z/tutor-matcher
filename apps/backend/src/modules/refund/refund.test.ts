import { describe, expect, it } from "@jest/globals";
import { refundBlock } from "./refund.policy.ts";
import { createRefundRequestSchema, refundReviewSchema } from "./refund.schema.ts";

const endedAt = new Date("2026-11-01T10:00:00.000Z");
const base = { status: "CONFIRMED" as const, endedAt, paid: true, hasRequest: false };
const hours = (count: number) => new Date(endedAt.getTime() + count * 3_600_000);

describe("PAY-3 refund request timing", () => {
  it("opens at the lesson's scheduled end, with no deadline", () => {
    expect(refundBlock(base, hours(-0.01))).toBe("REFUND_LESSON_NOT_ENDED");
    expect(refundBlock(base, endedAt)).toBeNull();
    expect(refundBlock(base, hours(24 * 365))).toBeNull();
  });

  it("allows a lesson the Tutor confirmed, so an admin can decide", () => {
    expect(refundBlock({ ...base, status: "COMPLETED" }, hours(1))).toBeNull();
  });

  it("allows one request per paid, uncancelled lesson", () => {
    expect(refundBlock({ ...base, hasRequest: true }, hours(1))).toBe("REFUND_ALREADY_REQUESTED");
    expect(refundBlock({ ...base, status: "CANCELLED" }, hours(1))).toBe("REFUND_NOT_ELIGIBLE");
    expect(refundBlock({ ...base, status: "PENDING_PAYMENT" }, hours(1))).toBe(
      "REFUND_NOT_ELIGIBLE"
    );
    expect(refundBlock({ ...base, paid: false }, hours(1))).toBe("REFUND_NOT_ELIGIBLE");
  });
});

describe("PAY-3 refund request input", () => {
  it("needs details for an unsatisfactory lesson but not for a no-show", () => {
    expect(createRefundRequestSchema.safeParse({ reason: "TUTOR_NO_SHOW" }).success).toBe(true);
    expect(createRefundRequestSchema.safeParse({ reason: "UNSATISFACTORY_LESSON" }).success).toBe(
      false
    );
    expect(
      createRefundRequestSchema.safeParse({ reason: "UNSATISFACTORY_LESSON", details: "   " })
        .success
    ).toBe(false);
    expect(
      createRefundRequestSchema.safeParse({
        reason: "UNSATISFACTORY_LESSON",
        details: "The tutor did not cover the agreed topic",
      }).success
    ).toBe(true);
    expect(
      createRefundRequestSchema.safeParse({ reason: "TUTOR_NO_SHOW", details: "x".repeat(1001) })
        .success
    ).toBe(false);
    // "Other" also needs an explanation; unknown reasons are refused.
    expect(createRefundRequestSchema.safeParse({ reason: "OTHER" }).success).toBe(false);
    expect(
      createRefundRequestSchema.safeParse({ reason: "OTHER", details: "Wrong subject taught" })
        .success
    ).toBe(true);
    expect(createRefundRequestSchema.safeParse({ reason: "SOMETHING" }).success).toBe(false);
  });

  it("needs a reason the Student will see when an admin rejects", () => {
    expect(refundReviewSchema.safeParse({ decision: "APPROVED" }).success).toBe(true);
    expect(refundReviewSchema.safeParse({ decision: "REJECTED" }).success).toBe(false);
    expect(
      refundReviewSchema.safeParse({
        decision: "REJECTED",
        rejectionReason: "Lesson recording shows a full session",
      }).success
    ).toBe(true);
  });
});
