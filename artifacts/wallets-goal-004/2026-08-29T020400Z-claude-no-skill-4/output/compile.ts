import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import solc from "solc";

/**
 * Compiles everything in contracts/ into artifacts/<ContractName>.json.
 *
 * Uses the solc JS bindings so a teammate needs nothing beyond `npm install`
 * — no Foundry, no Hardhat, no system solc.
 */

const CONTRACTS_DIR = resolve("contracts");
const ARTIFACTS_DIR = resolve("artifacts");

type SolcOutput = {
  errors?: { severity: string; formattedMessage: string }[];
  contracts?: Record<
    string,
    Record<
      string,
      { abi: unknown[]; evm: { bytecode: { object: string } } }
    >
  >;
};

/** Lets contracts `import` packages installed under node_modules. */
function findImport(path: string): { contents: string } | { error: string } {
  for (const base of ["node_modules", "contracts"]) {
    try {
      return { contents: readFileSync(resolve(base, path), "utf8") };
    } catch {
      // try the next base
    }
  }
  return { error: `Could not find ${path}` };
}

export function compile(): void {
  const sources: Record<string, { content: string }> = {};
  for (const file of readdirSync(CONTRACTS_DIR)) {
    if (file.endsWith(".sol")) {
      sources[file] = { content: readFileSync(join(CONTRACTS_DIR, file), "utf8") };
    }
  }

  if (Object.keys(sources).length === 0) {
    throw new Error(`No .sol files found in ${CONTRACTS_DIR}`);
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  const output: SolcOutput = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImport }),
  );

  const errors = output.errors ?? [];
  for (const error of errors) {
    console.error(error.formattedMessage);
  }
  if (errors.some((e) => e.severity === "error")) {
    throw new Error("Compilation failed.");
  }

  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  let written = 0;
  for (const contracts of Object.values(output.contracts ?? {})) {
    for (const [name, contract] of Object.entries(contracts)) {
      writeFileSync(
        join(ARTIFACTS_DIR, `${name}.json`),
        `${JSON.stringify(
          {
            contractName: name,
            abi: contract.abi,
            bytecode: `0x${contract.evm.bytecode.object}`,
          },
          null,
          2,
        )}\n`,
      );
      console.log(`  compiled ${name} -> artifacts/${name}.json`);
      written += 1;
    }
  }

  console.log(`\nCompiled ${written} contract(s) with solc ${solc.version()}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    compile();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
