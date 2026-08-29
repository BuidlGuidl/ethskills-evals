/**
 * Compiles every contract in contracts/ with solc and writes one artifact per
 * contract to out/<Name>.json ({ abi, bytecode }).
 *
 *   npm run compile
 *
 * Kept deliberately small: no framework to install, no global toolchain to
 * match versions on. If you later move to Foundry or Hardhat, delete this file
 * and point ARTIFACT_DIR in deploy.ts at that framework's output instead.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("solc");

const CONTRACTS_DIR = "contracts";
const OUT_DIR = "out";

/** Let contracts `import` from node_modules (e.g. OpenZeppelin) and from disk. */
function findImport(path: string): { contents: string } | { error: string } {
  const candidates = [path, join("node_modules", path), join(CONTRACTS_DIR, path)];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return { contents: readFileSync(candidate, "utf8") };
  }
  try {
    return { contents: readFileSync(require.resolve(path), "utf8") };
  } catch {
    return { error: `Could not find import "${path}"` };
  }
}

const sources: Record<string, { content: string }> = {};
for (const file of readdirSync(CONTRACTS_DIR)) {
  if (file.endsWith(".sol")) {
    sources[file] = { content: readFileSync(join(CONTRACTS_DIR, file), "utf8") };
  }
}

if (Object.keys(sources).length === 0) {
  console.error(`No .sol files found in ${CONTRACTS_DIR}/.`);
  process.exit(1);
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // Needed for Etherscan verification of an optimized build.
    metadata: { bytecodeHash: "ipfs" },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "metadata"] } },
  },
};

const output = JSON.parse(
  solc.compile(JSON.stringify(input), { import: findImport }),
);

let failed = false;
for (const error of output.errors ?? []) {
  console.error(error.formattedMessage ?? error.message);
  if (error.severity === "error") failed = true;
}
if (failed) process.exit(1);

mkdirSync(OUT_DIR, { recursive: true });
let written = 0;
for (const [file, contracts] of Object.entries<any>(output.contracts ?? {})) {
  for (const [name, contract] of Object.entries<any>(contracts)) {
    const bytecode = `0x${contract.evm.bytecode.object}`;
    if (bytecode === "0x") continue; // interface or abstract contract
    writeFileSync(
      join(OUT_DIR, `${name}.json`),
      JSON.stringify(
        {
          contractName: name,
          sourceFile: file,
          solcVersion: solc.version(),
          abi: contract.abi,
          bytecode,
        },
        null,
        2,
      ),
    );
    console.log(`  ${name}  ->  ${join(OUT_DIR, `${name}.json`)}  (${(bytecode.length - 2) / 2} bytes)`);
    written += 1;
  }
}
console.log(`Compiled ${written} contract(s) with solc ${solc.version()}.`);
