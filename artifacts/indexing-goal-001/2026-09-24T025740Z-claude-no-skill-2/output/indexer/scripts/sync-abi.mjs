// Regenerates abis/StreakAbi.ts from the Foundry build output.
// Run `forge build` in ../contracts first.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifact = resolve(here, "../../contracts/out/Streak.sol/Streak.json");
const out = resolve(here, "../abis/StreakAbi.ts");

const { abi } = JSON.parse(readFileSync(artifact, "utf8"));
writeFileSync(
  out,
  `// Generated from contracts/src/Streak.sol — regenerate with \`npm run sync-abi\`.\nexport const StreakAbi = ${JSON.stringify(abi, null, 2)} as const;\n`,
);
console.log(`wrote ${out}`);
