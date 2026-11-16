import { isPromptPayId, promptPayPayload } from "./promptpay";

describe("promptPayPayload", () => {
  it.each([
    [
      "0812345678",
      500,
      "00020101021229370016A000000677010111011300668123456785802TH53037645406500.00630416BF",
    ],
    [
      "0812345678",
      4.22,
      "00020101021229370016A000000677010111011300668123456785802TH530376454044.2263045D49",
    ],
    [
      "1234567890123",
      750.5,
      "00020101021229370016A000000677010111021312345678901235802TH53037645406750.506304FC1E",
    ],
    [
      "004999000288505",
      1000,
      "00020101021229390016A00000067701011103150049990002885055802TH530376454071000.006304D8D7",
    ],
  ])("encodes %s for ฿%d like the promptpay-qr reference", (id, amount, expected) => {
    expect(promptPayPayload(id, amount)).toBe(expected);
  });

  it("rejects anything that is not a PromptPay ID", () => {
    expect(() => promptPayPayload("not a number", 500)).toThrow("Invalid PromptPay ID");
    for (const id of [null, "", "812345678", "081-234-5678", "12345678901234"]) {
      expect(isPromptPayId(id)).toBe(false);
    }
    expect(isPromptPayId("0812345678")).toBe(true);
  });
});
