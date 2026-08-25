/**
 * Starts an anvil node whose clock is already rewound, so that
 * `scripts/seed-local.mjs` has room to replay months of check-ins before
 * reaching the present. A chain's timestamps only ever move forward, so this
 * has to be set at genesis — it cannot be fixed on a running node.
 *
 *   pnpm anvil                       # 90 days of headroom, port 8545
 *   SEED_DAYS=180 ANVIL_PORT=8600 pnpm anvil
 */
import { spawn } from "node:child_process";

const SECONDS_PER_DAY = 86_400;
const days = Number(process.env.SEED_DAYS ?? 90);
const port = process.env.ANVIL_PORT ?? "8545";
const chainId = process.env.CHAIN_ID ?? "31337";

// One extra day of headroom so the first day of history starts after genesis.
const timestamp = Math.floor(Date.now() / 1000) - (days + 1) * SECONDS_PER_DAY;

const args = [
  "--chain-id", chainId,
  "--port", port,
  "--timestamp", String(timestamp),
  "--silent",
  ...process.argv.slice(2),
];

console.log(
  `anvil on port ${port}, clock starting ${new Date(timestamp * 1000).toISOString()} ` +
    `(${days + 1} days ago)`,
);

const child = spawn("anvil", args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error("anvil not found — install Foundry: https://getfoundry.sh");
    process.exit(1);
  }
  throw error;
});
