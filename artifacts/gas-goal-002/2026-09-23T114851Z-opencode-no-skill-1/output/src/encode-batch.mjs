const ENTRY_BYTES = 28;
const MAX_UINT64 = 2n ** 64n - 1n;

export function encodePackedBatch(transfers) {
  if (!Array.isArray(transfers)) throw new TypeError("transfers must be an array");
  const blob = Buffer.alloc(transfers.length * ENTRY_BYTES);
  let total = 0n;
  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i];
    if (!t || typeof t.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(t.recipient)) {
      throw new Error(`invalid recipient at index ${i}`);
    }
    if (typeof t.amount !== "bigint" && typeof t.amount !== "number") {
      throw new Error(`invalid amount at index ${i}`);
    }
    const amount = BigInt(t.amount);
    if (amount < 0n || amount > MAX_UINT64) {
      throw new Error(`amount out of uint64 range at index ${i}: ${amount}`);
    }
    blob.write(t.recipient.slice(2).toLowerCase(), i * ENTRY_BYTES, 20, "hex");
    blob.writeBigUInt64BE(amount, i * ENTRY_BYTES + 20);
    total += amount;
  }
  return { blob: "0x" + blob.toString("hex"), count: transfers.length, total: total.toString() };
}

export function decodePackedBatch(blobHex) {
  const raw = blobHex.startsWith("0x") ? blobHex.slice(2) : blobHex;
  if (raw.length % (ENTRY_BYTES * 2) !== 0) throw new Error("blob length not a multiple of 28 bytes");
  const buf = Buffer.from(raw, "hex");
  const transfers = [];
  for (let i = 0; i < buf.length / ENTRY_BYTES; i++) {
    transfers.push({
      recipient: "0x" + buf.toString("hex", i * ENTRY_BYTES, i * ENTRY_BYTES + 20),
      amount: buf.readBigUInt64BE(i * ENTRY_BYTES + 20),
    });
  }
  return transfers;
}

export function distributePackedCall(token, transfers) {
  const { blob, count, total } = encodePackedBatch(transfers);
  const blobHex = blob.slice(2);
  const data =
    distributePackedSelector() + pad32(token) + pad32(0x60) + pad32(blobHex.length / 2) + blobHex;
  return { to: token, data: "0x" + data, blob, count, total };
}

export function distributePackedSelector() {
  return "13820813";
}

export function distributeCall(settler, token, recipients, amounts) {
  if (recipients.length !== amounts.length) throw new Error("length mismatch");
  const n = recipients.length;
  const data =
    distributeArraysSelector() +
    pad32(token) +
    pad32(0x60) +
    pad32(0x60 + 32 + 32 * n) +
    pad32(n) +
    recipients.map((r) => pad32(r)).join("") +
    pad32(n) +
    amounts.map((a) => pad32(a)).join("");
  return { to: settler, data: "0x" + data, count: n };
}

export function distributeArraysSelector() {
  return "15270ace";
}

function pad32(v) {
  if (typeof v === "string" && /^0x[0-9a-fA-F]+$/.test(v)) {
    const s = v.slice(2).toLowerCase();
    if (s.length !== 40) throw new Error("expected 20-byte address");
    return s.padStart(64, "0");
  }
  const h = BigInt(v).toString(16);
  if (h.length > 64) throw new Error("value wider than 32 bytes");
  return h.padStart(64, "0");
}
