/**
 * Compiles every contract in contracts/ with solc and writes one artifact per
 * contract to artifacts/<Name>.json ({ abi, bytecode }).
 *
 *   npm run compile
 *
 * Using the solc npm package keeps this repo self-contained — no Foundry or
 * Hardhat install needed. If the team later adopts Foundry, point deploy.ts at
 * out/<Name>.sol/<Name>.json instead and delete this file.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import solc from "solc";

const CONTRACTS_DIR = "contracts";
const ARTIFACTS_DIR = "artifacts";

type SolcError = { severity: string; formattedMessage: string };

const sources: Record<string, { content: string }> = {};
for (const file of readdirSync(CONTRACTS_DIR)) {
  if (file.endsWith(".sol")) {
    sources[file] = { content: readFileSync(join(CONTRACTS_DIR, file), "utf8") };
  }
}

if (Object.keys(sources).length === 0) {
  console.error(`✖ No .sol files found in ${CONTRACTS_DIR}/`);
  process.exit(1);
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

const errors: SolcError[] = output.errors ?? [];
for (const error of errors) {
  console.error(error.formattedMessage);
}
if (errors.some((e) => e.severity === "error")) {
  console.error("✖ Compilation failed.");
  process.exit(1);
}

mkdirSync(ARTIFACTS_DIR, { recursive: true });

let count = 0;
for (const [file, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [name, contract] of Object.entries(contracts as Record<string, any>)) {
    const artifact = {
      contractName: name,
      sourceName: file,
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
      compiler: `solc ${solc.version()}`,
    };
    writeFileSync(
      join(ARTIFACTS_DIR, `${name}.json`),
      `${JSON.stringify(artifact, null, 2)}\n`,
    );
    console.log(`  ${file}:${name} → ${ARTIFACTS_DIR}/${name}.json`);
    count += 1;
  }
}

console.log(`✔ Compiled ${count} contract${count === 1 ? "" : "s"}.`);
