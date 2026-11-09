import { describe, expect, it } from "@jest/globals";
import { refundBlock } from "./refund.policy.ts";
import { createRefundRequestSchema, refundReviewSchema } from "./refund.schema.ts";

const startedAt = new Date("2026-11-01T10:00:00.000Z");
const base = { status: "CONFIRMED" as const, startedAt, paid: true, hasRequest: false };
const hours = (count: number) => new Date(startedAt.getTime() + count * 3_600_000);

describe("PAY-3 refund request timing", () => {
  it("opens as soon as the lesson is paid, with no deadline", () => {
    expect(refundBlock(base, hours(-240))).toBeNull();
    expect(refundBlock(base, hours(-240), "UNSATISFACTORY_LESSON")).toBeNull();
    expect(refundBlock(base, hours(24 * 365))).toBeNull();
  });

  it("allows reporting a Tutor no-show only once the lesson has started", () => {
    expect(refundBlock(base, hours(-0.01), "TUTOR_NO_SHOW")).toBe("REFUND_NO_SHOW_TOO_EARLY");
    expect(refundBlock(base, startedAt, "TUTOR_NO_SHOW")).toBeNull();
    expect(refundBlock(base, hours(500), "TUTOR_NO_SHOW")).toBeNull();
  });

  it("rejects a completed lesson with its own reason", () => {
    expect(refundBlock({ ...base, status: "COMPLETED" }, hours(1))).toBe("REFUND_LESSON_COMPLETED");
    expect(refundBlock({ ...base, status: "COMPLETED" }, hours(100))).toBe(
      "REFUND_LESSON_COMPLETED"
    );
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
    expect(createRefundRequestSchema.safeParse({ reason: "OTHER" }).success).toBe(false);
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
