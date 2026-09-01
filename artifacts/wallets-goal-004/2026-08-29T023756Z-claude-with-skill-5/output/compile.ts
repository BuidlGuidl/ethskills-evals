/**
 * Compiles everything in contracts/ with the solc version pinned in
 * package.json and writes artifacts/<Name>.json.
 *
 *   npm run compile
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import solc from "solc";

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
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

for (const err of output.errors ?? []) {
  console.error(err.formattedMessage);
}
if ((output.errors ?? []).some((e: { severity: string }) => e.severity === "error")) {
  process.exit(1);
}

mkdirSync(ARTIFACTS_DIR, { recursive: true });
for (const [file, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [name, contract] of Object.entries(contracts as Record<string, any>)) {
    const bytecode = `0x${contract.evm.bytecode.object}`;
    writeFileSync(
      join(ARTIFACTS_DIR, `${name}.json`),
      `${JSON.stringify({ contractName: name, sourceName: file, abi: contract.abi, bytecode }, null, 2)}\n`,
    );
    console.log(`${name}  ->  ${ARTIFACTS_DIR}/${name}.json  (${(bytecode.length - 2) / 2} bytes)`);
  }
}
