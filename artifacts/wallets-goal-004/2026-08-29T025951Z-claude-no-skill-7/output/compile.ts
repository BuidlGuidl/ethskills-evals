import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import solc from "solc";

/**
 * Compiles everything in contracts/ and writes one JSON artifact per contract
 * to artifacts/<Name>.json ({ abi, bytecode }). deploy.ts reads those.
 *
 * Run with: npm run compile
 */

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

const errors = (output.errors ?? []).filter((e: any) => e.severity === "error");
for (const warning of (output.errors ?? []).filter((e: any) => e.severity !== "error")) {
  console.warn(warning.formattedMessage);
}
if (errors.length > 0) {
  for (const error of errors) console.error(error.formattedMessage);
  process.exit(1);
}

mkdirSync(ARTIFACTS_DIR, { recursive: true });

for (const [file, contracts] of Object.entries<any>(output.contracts)) {
  for (const [name, contract] of Object.entries<any>(contracts)) {
    const artifact = {
      contractName: name,
      sourceName: file,
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    };
    writeFileSync(join(ARTIFACTS_DIR, `${name}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`compiled ${file}:${name} -> ${ARTIFACTS_DIR}/${name}.json`);
  }
}
