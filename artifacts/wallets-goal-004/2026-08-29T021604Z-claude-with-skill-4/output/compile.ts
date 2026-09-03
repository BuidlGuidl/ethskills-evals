import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

/**
 * Compiles everything in contracts/ with solc and writes one JSON artifact per
 * contract into artifacts/ ({ abi, bytecode }). deploy.ts reads those.
 *
 * If you already use Foundry or Hardhat, drop this file and point deploy.ts at
 * their artifact instead:
 *   Foundry  out/Counter.sol/Counter.json   -> .abi and .bytecode.object
 *   Hardhat  artifacts/contracts/Counter.sol/Counter.json -> .abi and .bytecode
 */

const require = createRequire(import.meta.url);
// solc ships as CommonJS.
const solc = require("solc") as {
  compile(input: string): string;
  version(): string;
};

const CONTRACTS_DIR = "contracts";
const ARTIFACTS_DIR = "artifacts";

const sources: Record<string, { content: string }> = {};
for (const file of readdirSync(CONTRACTS_DIR)) {
  if (file.endsWith(".sol")) {
    sources[file] = { content: readFileSync(join(CONTRACTS_DIR, file), "utf8") };
  }
}

if (Object.keys(sources).length === 0) {
  throw new Error(`No .sol files found in ${CONTRACTS_DIR}/`);
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "metadata"] } },
  },
};

console.log(`solc ${solc.version()}`);

const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
  errors?: Array<{ severity: string; formattedMessage: string }>;
  contracts?: Record<
    string,
    Record<
      string,
      { abi: unknown[]; evm: { bytecode: { object: string } }; metadata?: string }
    >
  >;
};

let failed = false;
for (const error of output.errors ?? []) {
  console.error(error.formattedMessage);
  if (error.severity === "error") failed = true;
}
if (failed) process.exit(1);

mkdirSync(ARTIFACTS_DIR, { recursive: true });

for (const [file, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [name, contract] of Object.entries(contracts)) {
    const bytecode = `0x${contract.evm.bytecode.object}`;
    writeFileSync(
      join(ARTIFACTS_DIR, `${name}.json`),
      `${JSON.stringify({ contractName: name, sourceName: file, abi: contract.abi, bytecode }, null, 2)}\n`,
    );
    const size = (bytecode.length - 2) / 2;
    console.log(`  ${name.padEnd(20)} ${size} bytes -> ${ARTIFACTS_DIR}/${name}.json`);
    if (size > 24576) {
      console.warn(`  WARNING: ${name} exceeds the 24576-byte EIP-170 limit.`);
    }
  }
}
