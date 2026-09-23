// Encoder for BatchTransfer.batchPacked(token, bytes).
//
// Each transfer becomes ONE 32-byte calldata word:
//   [ 20-byte recipient address ][ 12-byte uint96 amount (big-endian) ]
// i.e. word = (address << 96) | amount — identical to Solidity's
// abi.encodePacked(address, uint96).
//
// 32 bytes/transfer vs 64 bytes for the address[]/uint256[] variant,
// which halves the L1 data fee per transfer on Base.

const MAX_UINT96 = (1n << 96n) - 1n;

/**
 * @param {Array<{to: string, amount: bigint|number|string}>} entries
 * @returns {string} 0x-prefixed packed bytes, length = 32 * entries.length
 */
function packTransfers(entries) {
  if (!entries.length) throw new Error("empty batch");
  const parts = [];
  for (const { to, amount } of entries) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error(`bad address: ${to}`);
    const amt = BigInt(amount);
    if (amt < 0n || amt > MAX_UINT96) throw new Error(`amount exceeds uint96: ${amt}`);
    parts.push(to.slice(2).toLowerCase() + amt.toString(16).padStart(24, "0"));
  }
  return "0x" + parts.join("");
}

module.exports = { packTransfers, MAX_UINT96 };
