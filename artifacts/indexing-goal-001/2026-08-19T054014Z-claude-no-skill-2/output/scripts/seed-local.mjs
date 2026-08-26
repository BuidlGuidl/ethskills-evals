/**
 * Seeds a local anvil node with months of Streak history.
 *
 * The point of the app is that it shows the *complete* record from the
 * contract's first day, so local development needs a chain that already has a
 * long past by the time the indexer starts. This deploys Streak at a timestamp
 * `--days` ago, walks the chain forward one UTC day at a time with members
 * checking in (and occasionally missing a day, so streaks break realistically),
 * and finishes at the present.
 *
 * Usage:
 *   pnpm anvil                             # terminal 1, clock rewound 90 days
 *   pnpm seed:local -- --days 90 --members 8
 *
 * Prints the contract address and deployment block for indexer/.env.local.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const SECONDS_PER_DAY = 86_400;

// The standard anvil mnemonic accounts. Account 0 deploys and funds the rest.
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

const DAYS = arg("days", 90);
const MEMBER_COUNT = Math.min(arg("members", 8), KEYS.length - 1);

const NOTES = [
  "gm",
  "shipped the docs",
  "reviewing PRs today",
  "",
  "deployed to testnet",
  "gm gm",
  "pairing on the indexer",
  "",
  "wrote tests",
  "back from a break",
];

// Deterministic PRNG so seeded histories are reproducible run to run.
let seed = 42;
const random = () => {
  seed = (seed * 1_664_525 + 1_013_904_223) % 2 ** 32;
  return seed / 2 ** 32;
};

const transport = http(RPC);
const publicClient = createPublicClient({ chain: anvil, transport });
const deployer = privateKeyToAccount(KEYS[0]);
const deployerWallet = createWalletClient({ account: deployer, chain: anvil, transport });

const members = KEYS.slice(1, MEMBER_COUNT + 1).map((key) =>
  createWalletClient({ account: privateKeyToAccount(key), chain: anvil, transport }),
);

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

function readArtifact() {
  const path = join(root, "contracts", "out", "Streak.sol", "Streak.json");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error("Build the contracts first:  cd contracts && forge build");
    process.exit(1);
  }
}

async function main() {
  const artifact = readArtifact();
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object;

  // A chain's clock can only move forward, so the history has to start from
  // wherever the node's clock currently is. `pnpm anvil` starts the node with
  // its clock already rewound (`anvil --timestamp ...`) so there is room for
  // DAYS of past to fit in before the present.
  const now = Math.floor(Date.now() / 1000);
  const tip = await publicClient.getBlock();
  const earliest = Number(tip.timestamp) + 1;

  // Days are UTC days, exactly as the contract counts them
  // (`block.timestamp / 86400`), so seeded check-ins land one per member per
  // contract-day and streaks come out meaning what they say.
  const today = Math.floor(now / SECONDS_PER_DAY);
  const firstDay = Math.ceil(Math.max(earliest, now - DAYS * SECONDS_PER_DAY) / SECONDS_PER_DAY);
  const days = today - firstDay;

  if (days < 1) {
    console.error(
      `The node's clock is at ${new Date(earliest * 1000).toISOString()}, which leaves no\n` +
        `room for past check-ins. Restart it with a rewound clock:\n\n` +
        `  SEED_DAYS=${DAYS} pnpm anvil\n`,
    );
    process.exit(1);
  }
  if (days < DAYS) {
    console.warn(
      `Node clock only allows ${days} days of history (asked for ${DAYS}). ` +
        `Restart with \`SEED_DAYS=${DAYS} pnpm anvil\` for the full span.`,
    );
  }

  const startTimestamp = Math.max(earliest, firstDay * SECONDS_PER_DAY);

  await rpc("evm_setNextBlockTimestamp", [startTimestamp]);
  await rpc("anvil_setAutomine", [true]);

  const deployHash = await deployerWallet.deployContract({ abi, bytecode });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const address = receipt.contractAddress;
  const startBlock = Number(receipt.blockNumber);

  // Anvil accounts are pre-funded, but top up in case a custom node isn't.
  for (const wallet of members) {
    const balance = await publicClient.getBalance({ address: wallet.account.address });
    if (balance < parseEther("0.05")) {
      const hash = await deployerWallet.sendTransaction({
        to: wallet.account.address,
        value: parseEther("1"),
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }

  console.log(`Seeding ${days} days of check-ins for ${members.length} members...`);

  // Each member gets a "dedication" — how likely they are to show up on a given
  // day — so the leaderboard and the streaks have a real spread.
  const dedication = members.map((_, i) => 0.35 + (0.6 * i) / Math.max(members.length - 1, 1));

  let checkIns = 0;
  // Block timestamps must strictly increase, so check-ins are laid down in a
  // single forward pass over UTC days. The last pass covers the part of today
  // that has already happened, so the app opens with live streaks rather than
  // a history that stops yesterday.
  let lastTimestamp = startTimestamp - 1;

  for (let day = firstDay; day <= today; day++) {
    const dayStart = Math.max(day * SECONDS_PER_DAY, lastTimestamp + 1);
    const dayEnd = Math.min(day * SECONDS_PER_DAY + SECONDS_PER_DAY - 1, now - 1);
    if (dayEnd < dayStart) break;

    let timestamp = dayStart;

    for (const [i, wallet] of members.entries()) {
      if (random() > dedication[i]) continue;

      timestamp += Math.floor(random() * 3_000) + 60;
      if (timestamp > dayEnd) break; // no room left in this UTC day

      await rpc("evm_setNextBlockTimestamp", [timestamp]);
      const hash = await wallet.sendTransaction({
        to: address,
        data: encodeFunctionData({
          abi,
          functionName: "checkIn",
          args: [NOTES[Math.floor(random() * NOTES.length)]],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      lastTimestamp = timestamp;
      checkIns++;
    }
  }

  // Land the chain tip at the present so "today" and "this month" line up with
  // wall-clock time.
  const head = await publicClient.getBlock();
  if (Number(head.timestamp) < now) {
    await rpc("evm_setNextBlockTimestamp", [now]);
    await rpc("evm_mine", []);
  }

  const totalCheckIns = await publicClient.readContract({
    address,
    abi,
    functionName: "totalCheckIns",
  });
  const totalMembers = await publicClient.readContract({
    address,
    abi,
    functionName: "totalMembers",
  });

  console.log(`
Seeded ${checkIns} check-ins (contract reports ${totalCheckIns} from ${totalMembers} members).

Put this in indexer/.env.local:

  CHAIN_ID=31337
  PONDER_RPC_URL=${RPC}
  STREAK_ADDRESS=${address}
  STREAK_START_BLOCK=${startBlock}
  PONDER_LOGS_BLOCK_RANGE=10000
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
