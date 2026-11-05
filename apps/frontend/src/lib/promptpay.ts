// Builds the EMVCo text a Thai banking app reads from a PromptPay QR.
const AID = "A000000677010111";

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

// CRC-16/CCITT-FALSE, which the EMVCo QR format requires as its last field.
function checksum(text: string) {
  let crc = 0xffff;
  for (let index = 0; index < text.length; index++) {
    crc ^= text.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// A phone number (10 digits), national or tax ID (13) or e-wallet ID (15).
function receiver(id: string) {
  if (/^0\d{9}$/.test(id)) return field("01", `0066${id.slice(1)}`);
  if (/^\d{13}$/.test(id)) return field("02", id);
  if (/^\d{15}$/.test(id)) return field("03", id);
  return null;
}

export function isPromptPayId(id: string | null): id is string {
  return id !== null && receiver(id) !== null;
}

export function promptPayPayload(id: string, amount: number) {
  const target = receiver(id);
  if (!target) throw new Error("Invalid PromptPay ID");
  const body = [
    field("00", "01"),
    field("01", "12"), // 12: a one-time QR with the amount locked.
    field("29", field("00", AID) + target),
    field("58", "TH"),
    field("53", "764"),
    field("54", amount.toFixed(2)),
    "6304",
  ].join("");
  return body + checksum(body);
}
