/**
 * Compiles contracts/*.sol with solc and writes artifacts/<Name>.json
 * ({ abi, bytecode }) for deploy.ts to consume.
 *
 *   npm run compile
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import solc from "solc";

const CONTRACTS_DIR = "contracts";
const ARTIFACTS_DIR = "artifacts";

const sources: Record<string, { content: string }> = {};
for (const file of readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith(".sol"))) {
  sources[file] = { content: readFileSync(join(CONTRACTS_DIR, file), "utf8") };
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
for (const [file, contracts] of Object.entries(output.contracts as Record<string, any>)) {
  for (const [name, contract] of Object.entries(contracts as Record<string, any>)) {
    const artifact = {
      contractName: name,
      sourceName: `${CONTRACTS_DIR}/${file}`,
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    };
    writeFileSync(join(ARTIFACTS_DIR, `${name}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`compiled ${name} -> ${ARTIFACTS_DIR}/${name}.json`);
  }
}
