// Regenerates src/core/abi.ts from the Foundry build artifact so the frontend
// can never drift from the deployed contract's interface.
// Usage: (cd ../contracts && forge build) && npm run abi
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifact = resolve(here, "../../contracts/out/Toolshed.sol/Toolshed.json");
const target = resolve(here, "../src/core/abi.ts");

const { abi } = JSON.parse(readFileSync(artifact, "utf8"));
const erc20 = `

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
`;

writeFileSync(
  target,
  `// Generated from contracts/out/Toolshed.sol/Toolshed.json by scripts/gen-abi.mjs.\n// Do not edit by hand; run \`npm run abi\` instead.\n\nexport const toolshedAbi = ${JSON.stringify(abi, null, 2)} as const;\n${erc20}`,
);
console.log(`wrote ${target} (${abi.length} entries)`);
