/** Hand-rolled ABI encoding helpers — enough for ERC-20 transfer + batching. */

function stripHex(s: string): string {
  return s.startsWith("0x") ? s.slice(2) : s;
}

export function padAddress(addr: string): string {
  const a = stripHex(addr).toLowerCase();
  if (a.length !== 40) throw new Error(`bad address: ${addr}`);
  return a.padStart(64, "0");
}

export function padUint(v: bigint): string {
  if (v < 0n) throw new Error("negative uint");
  const h = v.toString(16);
  if (h.length > 64) throw new Error("uint256 overflow");
  return h.padStart(64, "0");
}
