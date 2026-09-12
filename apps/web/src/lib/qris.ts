/**
 * Turns the stall's static QRIS (printed sticker) into a per-order dynamic
 * QRIS with the amount embedded, so customers don't have to type the total.
 *
 * QRIS is EMVCo TLV: 2-char tag, 2-digit length, value. Tag 01 = "11" static,
 * "12" dynamic. Tag 54 = transaction amount. Tag 63 = CRC16-CCITT over the
 * whole payload up to and including "6304".
 */

// Decoded from the Potatoni QRIS sticker (NMID ID1026581364258, terminal A01).
export const STATIC_QRIS_PAYLOAD =
  process.env.QRIS_PAYLOAD ??
  "00020101021126650013ID.CO.BCA.WWW011893600014000478258402150008850047825840303UMI51440014ID.CO.QRIS.WWW0215ID10265813642580303UMI5204581453033605802ID5908Potatoni6007BANDUNG61054039462070703A0163048E5C";

type Tlv = { tag: string; value: string };

function parseTlv(payload: string): Tlv[] {
  const out: Tlv[] = [];
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || Number.isNaN(len)) {
      throw new Error(`Invalid QRIS payload at offset ${i}`);
    }
    out.push({ tag, value: payload.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

function encodeTlv({ tag, value }: Tlv) {
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

export function crc16(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function isValidQris(payload: string) {
  const body = payload.slice(0, -4);
  return body.endsWith("6304") && crc16(body) === payload.slice(-4);
}

export function toDynamicQris(amount: number, payload = STATIC_QRIS_PAYLOAD) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("QRIS amount must be a positive integer (rupiah)");
  }
  const fields = parseTlv(payload).filter((f) => f.tag !== "63" && f.tag !== "54");
  const pointOfInitiation = fields.find((f) => f.tag === "01");
  if (pointOfInitiation) pointOfInitiation.value = "12";

  // Tags are ascending; 54 sits right after 53 (currency).
  const insertAt = fields.findIndex((f) => Number(f.tag) > 54);
  const amountField = { tag: "54", value: String(amount) };
  if (insertAt === -1) fields.push(amountField);
  else fields.splice(insertAt, 0, amountField);

  const body = `${fields.map(encodeTlv).join("")}6304`;
  return body + crc16(body);
}
