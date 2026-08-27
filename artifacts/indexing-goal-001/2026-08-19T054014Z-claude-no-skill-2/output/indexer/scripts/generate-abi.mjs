// Regenerates abis/streakAbi.ts from the Foundry build output.
// Usage: (cd contracts && forge build) && pnpm abi
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifact = join(here, "..", "..", "contracts", "out", "Streak.sol", "Streak.json");
const target = join(here, "..", "abis", "streakAbi.ts");

let abi;
try {
  abi = JSON.parse(readFileSync(artifact, "utf8")).abi;
} catch {
  console.error(`Could not read ${artifact}. Run \`forge build\` in contracts/ first.`);
  process.exit(1);
}

writeFileSync(
  target,
  `// Generated from contracts/src/Streak.sol — regenerate with \`pnpm abi\`.\n` +
    `// Do not edit by hand.\n` +
    `export const streakAbi = ${JSON.stringify(abi, null, 2)} as const;\n`,
);
console.log(`Wrote ${target}`);
