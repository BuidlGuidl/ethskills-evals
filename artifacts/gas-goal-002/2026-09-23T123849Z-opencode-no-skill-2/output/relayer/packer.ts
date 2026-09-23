export const CHUNK_BYTES = 32;
export const MAX_UINT96 = (1n << 96n) - 1n;
export const ADDRESS_BYTES = 20;

export type Transfer = {
  to: `0x${string}`;
  amount: bigint;
};

export class InvalidTransferError extends Error {
  constructor(
    readonly index: number,
    readonly reason: string,
  ) {
    super(`invalid transfer at index ${index}: ${reason}`);
    this.name = "InvalidTransferError";
  }
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function validateTransfer(transfer: Transfer, index = 0): void {
  if (!ADDRESS_RE.test(transfer.to)) {
    throw new InvalidTransferError(index, `bad address: ${transfer.to}`);
  }
  if (transfer.to === "0x0000000000000000000000000000000000000000") {
    throw new InvalidTransferError(index, "zero address");
  }
  if (transfer.amount <= 0n) {
    throw new InvalidTransferError(index, "amount must be > 0");
  }
  if (transfer.amount > MAX_UINT96) {
    throw new InvalidTransferError(index, `amount ${transfer.amount} exceeds uint96`);
  }
}

function toHexAddress(address: string): string {
  return address.toLowerCase().slice(0, 2 + ADDRESS_BYTES * 2);
}

export function packChunk(transfer: Transfer): string {
  const addressHex = toHexAddress(transfer.to).slice(2);
  const amountHex = transfer.amount.toString(16).padStart(24, "0");
  return addressHex + amountHex;
}

export function packBatch(transfers: Transfer[]): `0x${string}` {
  if (transfers.length === 0) {
    throw new Error("empty batch");
  }
  let hex = "";
  for (let i = 0; i < transfers.length; i++) {
    validateTransfer(transfers[i]!, i);
    hex += packChunk(transfers[i]!);
  }
  return `0x${hex}`;
}

export function unpackBatch(packed: `0x${string}`): Transfer[] {
  const hex = packed.slice(2);
  if (hex.length === 0 || hex.length % (CHUNK_BYTES * 2) !== 0) {
    throw new Error(`packed length ${hex.length / 2} bytes is not a multiple of 32`);
  }
  const count = hex.length / (CHUNK_BYTES * 2);
  const transfers: Transfer[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i * CHUNK_BYTES * 2;
    const to = `0x${hex.slice(offset, offset + ADDRESS_BYTES * 2)}` as `0x${string}`;
    const amount = BigInt(`0x${hex.slice(offset + ADDRESS_BYTES * 2, offset + CHUNK_BYTES * 2)}`);
    transfers.push({ to, amount });
  }
  return transfers;
}

export function batchTotal(transfers: Transfer[]): bigint {
  let total = 0n;
  for (const transfer of transfers) {
    validateTransfer(transfer);
    total += transfer.amount;
  }
  return total;
}
