// Copies the Streak ABI out of the Foundry build artifact into abis/streakAbi.ts.
// Run `forge build` in ../contracts first.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifactPath = resolve(here, "../../contracts/out/Streak.sol/Streak.json");
const outPath = resolve(here, "../abis/streakAbi.ts");

const { abi } = JSON.parse(readFileSync(artifactPath, "utf8"));

writeFileSync(
  outPath,
  `// Generated from contracts/src/Streak.sol via \`forge build\`.\n` +
    `// Regenerate with: npm run generate:abi (see package.json).\n` +
    `export const streakAbi = ${JSON.stringify(abi, null, 2)} as const;\n`,
);

console.log(`Wrote ${outPath}`);
