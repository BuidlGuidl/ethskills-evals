export type Hex = `0x${string}`;

const BATCH_TRANSFER_SELECTOR = "1239ec8c";
const ERC20_TRANSFER_SELECTOR = "a9059cbb";
const WITHDRAW_SELECTOR = "d9caed12";
const SET_PAUSED_SELECTOR = "16c38b3c";
const TRANSFER_OWNERSHIP_SELECTOR = "f2fde38b";
const ACCEPT_OWNERSHIP_SELECTOR = "79ba5097";

export const BATCH_EXECUTED_TOPIC =
  "0xca81223dee601f44c44ce11d952c9f947da2bb8f802f2fc0928e836f42a8cebf";
export const TRANSFER_FAILED_TOPIC =
  "0x77d85bbe9e2d90dc4e0a5153e5de22cc708506fbe1d7dc2bdc2dc653b2c04aea";

function stripHex(address: string): string {
  const lowered = address.toLowerCase();
  return lowered.startsWith("0x") ? lowered.slice(2) : lowered;
}

function addressWord(address: string): string {
  const stripped = stripHex(address);
  if (stripped.length !== 40) {
    throw new Error(`invalid address: ${address}`);
  }
  return stripped.padStart(64, "0");
}

function uintWord(value: bigint): string {
  if (value < 0n) {
    throw new Error("negative uint");
  }
  return value.toString(16).padStart(64, "0");
}

export function encodeBatchTransfer(token: string, recipients: string[], amounts: bigint[]): Hex {
  if (recipients.length === 0) {
    throw new Error("empty batch");
  }
  if (recipients.length !== amounts.length) {
    throw new Error("length mismatch");
  }
  const head =
    addressWord(token) +
    uintWord(96n) +
    uintWord(BigInt(96 + 32 + 32 * recipients.length));
  const recipientWords = recipients.map(addressWord).join("");
  const amountWords = amounts.map(uintWord).join("");
  return `0x${BATCH_TRANSFER_SELECTOR}${head}${uintWord(BigInt(recipients.length))}${recipientWords}${uintWord(BigInt(amounts.length))}${amountWords}` as Hex;
}

export function encodeErc20Transfer(recipient: string, amount: bigint): Hex {
  return `0x${ERC20_TRANSFER_SELECTOR}${addressWord(recipient)}${uintWord(amount)}` as Hex;
}

export function encodeWithdraw(token: string, to: string, amount: bigint): Hex {
  return `0x${WITHDRAW_SELECTOR}${addressWord(token)}${addressWord(to)}${uintWord(amount)}` as Hex;
}

export function encodeSetPaused(paused: boolean): Hex {
  return `0x${SET_PAUSED_SELECTOR}${uintWord(paused ? 1n : 0n)}` as Hex;
}

export function encodeTransferOwnership(newOwner: string): Hex {
  return `0x${TRANSFER_OWNERSHIP_SELECTOR}${addressWord(newOwner)}` as Hex;
}

export function encodeAcceptOwnership(): Hex {
  return `0x${ACCEPT_OWNERSHIP_SELECTOR}` as Hex;
}

export interface TransferFailedEvent {
  index: bigint;
  recipient: string;
  amount: bigint;
}

export function parseTransferFailedLog(log: { topics: string[]; data: string }): TransferFailedEvent | null {
  if (log.topics[0] !== TRANSFER_FAILED_TOPIC || log.topics.length < 3) {
    return null;
  }
  return {
    index: BigInt(log.topics[1]),
    recipient: `0x${log.topics[2].slice(-40)}`,
    amount: BigInt(log.data === "0x" ? 0 : log.data),
  };
}

export interface BatchExecutedEvent {
  token: string;
  count: bigint;
  totalAmount: bigint;
  failedCount: bigint;
}

export function parseBatchExecutedLog(log: { topics: string[]; data: string }): BatchExecutedEvent | null {
  if (log.topics[0] !== BATCH_EXECUTED_TOPIC) {
    return null;
  }
  const data = log.data.slice(2);
  return {
    token: `0x${log.topics[1].slice(-40)}`,
    count: BigInt(`0x${data.slice(0, 64)}`),
    totalAmount: BigInt(`0x${data.slice(64, 128)}`),
    failedCount: BigInt(`0x${data.slice(128, 192)}`),
  };
}
