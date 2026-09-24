import type { Address, Hash, WalletClient } from "viem";
import { StreakAbi } from "../../indexer/abis/StreakAbi";

export const MAX_NOTE_BYTES = 140;

export function noteByteLength(note: string): number {
  return new TextEncoder().encode(note).length;
}

/**
 * The app's only write: check in for today, with an optional public note.
 * Reverts with AlreadyCheckedInToday if the member already checked in today —
 * gate the button with `canCheckInToday` first.
 */
export async function checkIn(
  wallet: WalletClient,
  contract: Address,
  note = "",
): Promise<Hash> {
  if (noteByteLength(note) > MAX_NOTE_BYTES) {
    throw new Error(`note is ${noteByteLength(note)} bytes, max ${MAX_NOTE_BYTES}`);
  }
  const account = wallet.account;
  if (account === undefined) throw new Error("wallet client has no account");

  return wallet.writeContract({
    address: contract,
    abi: StreakAbi,
    functionName: "checkIn",
    args: [note],
    account,
    chain: wallet.chain,
  });
}
