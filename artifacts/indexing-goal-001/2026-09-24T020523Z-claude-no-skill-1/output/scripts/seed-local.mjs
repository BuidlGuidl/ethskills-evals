/**
 * Local development seed.
 *
 * Deploys Streak to a running anvil and back-dates ~4 months of check-ins by
 * mining one block per day. The point is to reproduce the real launch condition:
 * the contract already has months of history before the app is ever opened, so
 * the indexer has something substantial to backfill.
 *
 * Usage: anvil (in another terminal), then `npm run seed`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, getContract } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const DAYS = Number(process.env.SEED_DAYS ?? 120);
const MEMBER_COUNT = Number(process.env.SEED_MEMBERS ?? 8);
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
const SECONDS_PER_DAY = 86_400;

const NOTES = [
  "gm",
  "gm gm",
  "shipped the docs",
  "reviewed 3 PRs",
  "fixed the indexer",
  "wrote tests, finally",
  "deployed to Base",
  "",
  "",
  "paired with @ana on the API",
  "day off from code, still here",
  "onchain summer forever",
];

const artifact = JSON.parse(readFileSync(join(root, "contracts/out/Streak.sol/Streak.json"), "utf8"));

// Deterministic pseudo-randomness so reruns produce the same history.
let seed = 42;
const rand = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

const transport = http(RPC);
const publicClient = createPublicClient({ chain: foundry, transport });

const deployer = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 });
const members = Array.from({ length: MEMBER_COUNT }, (_, i) =>
  mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i }),
);

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== 31337) throw new Error(`Expected anvil (31337) at ${RPC}, got chain ${chainId}`);

  // Start the history DAYS days ago, at 09:00 UTC on that day. anvil refuses to
  // move time backwards, so it has to have been started back-dated (`npm run anvil`).
  const now = Math.floor(Date.now() / 1000);
  const startDay = Math.floor(now / SECONDS_PER_DAY) - DAYS + 1;
  const firstTimestamp = startDay * SECONDS_PER_DAY + 9 * 3600 - 60;
  const head = await publicClient.getBlock();
  if (Number(head.timestamp) > firstTimestamp) {
    throw new Error(
      `anvil's head block is newer than the history we want to write.\n` +
        `Restart it back-dated with \`npm run anvil\` (or pass a smaller SEED_DAYS).`,
    );
  }
  await rpc("evm_setNextBlockTimestamp", [firstTimestamp]);
  await rpc("evm_mine");

  const wallet = createWalletClient({ account: deployer, chain: foundry, transport });
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  const startBlock = Number(receipt.blockNumber);
  console.log(`Streak deployed at ${address} (block ${startBlock})`);

  // Each member gets an attendance rate; a couple of them are near-perfect so the
  // streak and leaderboard screens have something interesting to show.
  const rates = members.map((_, i) => (i === 0 ? 0.98 : i === 1 ? 0.9 : 0.35 + rand() * 0.45));

  await rpc("evm_setAutomine", [false]);
  const nonces = new Map();
  for (const m of members) {
    nonces.set(m.address, await publicClient.getTransactionCount({ address: m.address }));
  }

  let sent = 0;
  for (let d = 0; d < DAYS; d++) {
    const day = startDay + d;
    let queued = 0;

    for (const [i, m] of members.entries()) {
      if (rand() > rates[i]) continue;
      const nonce = nonces.get(m.address);
      const memberWallet = createWalletClient({ account: m, chain: foundry, transport });
      await memberWallet.writeContract({
        abi: artifact.abi,
        address,
        functionName: "checkIn",
        args: [pick(NOTES)],
        nonce,
        gas: 200_000n,
      });
      nonces.set(m.address, nonce + 1);
      queued++;
      sent++;
    }

    // One block per day, timestamped inside that UTC day.
    await rpc("evm_setNextBlockTimestamp", [day * SECONDS_PER_DAY + 9 * 3600 + (d % 60) * 60]);
    await rpc("evm_mine");
    if (queued === 0) continue;
    if (d % 20 === 0) console.log(`  day ${d + 1}/${DAYS} … ${sent} check-ins so far`);
  }
  await rpc("evm_setAutomine", [true]);

  const streak = getContract({ abi: artifact.abi, address, client: publicClient });
  const total = await streak.read.totalCheckIns();
  console.log(`Seeded ${total} check-ins from ${MEMBER_COUNT} members across ${DAYS} days.`);
  console.log(`Best streak (account 0): ${await streak.read.currentStreak([members[0].address])}`);

  const envPath = join(root, "indexer/.env.local");
  const env = [
    "# Written by scripts/seed-local.mjs — local anvil setup.",
    "PONDER_RPC_URL=http://127.0.0.1:8545",
    "CHAIN_ID=31337",
    `STREAK_ADDRESS=${address}`,
    `STREAK_START_BLOCK=${startBlock}`,
    "",
  ].join("\n");
  writeFileSync(envPath, env);
  console.log(`Wrote ${envPath}. Now run: npm run dev`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
