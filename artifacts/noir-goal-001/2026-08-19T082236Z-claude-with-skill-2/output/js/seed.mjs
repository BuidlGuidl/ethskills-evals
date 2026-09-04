// Local-chain convenience: fund the member wallets and the relayer, then have members join.
//
// On a real network none of this exists — each member funds their own wallet and calls
// js/join.mjs themselves, and the relayer is funded by whoever operates it.
//
// Usage: JOIN_COUNT=150 node js/seed.mjs
import { provider, memberWallet, relayerWallet, deployment, RELAYER_INDEX } from "./lib/chain.mjs";
import { join } from "./join.mjs";

const TEN_ETH = "0x8ac7230489e80000";

async function fund(address) {
  await provider.send("anvil_setBalance", [address, TEN_ETH]);
}

export async function seed({ joinCount = Number(process.env.JOIN_COUNT ?? 150), quiet = false } = {}) {
  const d = deployment();
  const count = Math.min(joinCount, d.memberCount);

  await fund(relayerWallet().address);
  for (let i = 0; i < count; i++) await fund(memberWallet(i).address);
  if (!quiet) {
    console.log(`funded ${count} member wallets + relayer (HD index ${RELAYER_INDEX})`);
    console.log(`joining ${count} members...`);
  }

  for (let i = 0; i < count; i++) {
    await join(i, { quiet: true });
    if (!quiet && (i + 1) % 25 === 0) console.log(`  ${i + 1}/${count} joined`);
  }
  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((e) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
}
