// Copies the Streak ABI from the Foundry build output into the indexer.
// Usage: cd contracts && forge build && node ../scripts/sync-abi.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = JSON.parse(
  readFileSync(join(root, "contracts/out/Streak.sol/Streak.json"), "utf8"),
);

writeFileSync(
  join(root, "indexer/abis/StreakAbi.ts"),
  `// Generated from contracts/src/Streak.sol — regenerate with:\n` +
    `//   cd contracts && forge build && node ../scripts/sync-abi.mjs\n` +
    `export const StreakAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`,
);

console.log("Wrote indexer/abis/StreakAbi.ts");
