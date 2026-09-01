import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import solc from "solc";

/**
 * Compiles every .sol file in contracts/ with solc and writes one JSON
 * artifact per contract to artifacts/<ContractName>.json ({ abi, bytecode }).
 *
 * Run with: npm run compile
 */

const CONTRACTS_DIR = resolve(process.cwd(), "contracts");
const ARTIFACTS_DIR = resolve(process.cwd(), "artifacts");

type SolcError = {
  severity: "error" | "warning" | "info";
  formattedMessage: string;
};

/** Lets contracts `import` from node_modules (e.g. OpenZeppelin) and from contracts/. */
function findImports(importPath: string): { contents: string } | { error: string } {
  const candidates = [
    join(CONTRACTS_DIR, importPath),
    join(process.cwd(), "node_modules", importPath),
    resolve(process.cwd(), importPath),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { contents: readFileSync(candidate, "utf8") };
    }
  }
  return { error: `File not found: ${importPath}` };
}

function main(): void {
  const sources: Record<string, { content: string }> = {};

  for (const file of readdirSync(CONTRACTS_DIR)) {
    if (!file.endsWith(".sol")) continue;
    sources[file] = { content: readFileSync(join(CONTRACTS_DIR, file), "utf8") };
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

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  );

  const diagnostics: SolcError[] = output.errors ?? [];
  for (const err of diagnostics) {
    if (err.severity !== "error") console.warn(err.formattedMessage);
  }
  const fatal = diagnostics.filter((e) => e.severity === "error");
  if (fatal.length > 0) {
    for (const err of fatal) console.error(err.formattedMessage);
    throw new Error(`Compilation failed with ${fatal.length} error(s).`);
  }

  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  let written = 0;
  for (const [sourceFile, contracts] of Object.entries(output.contracts ?? {})) {
    for (const [name, contract] of Object.entries(contracts as Record<string, any>)) {
      const bytecode = contract.evm.bytecode.object;
      if (!bytecode) continue; // interfaces and abstract contracts have none

      const artifactPath = join(ARTIFACTS_DIR, `${name}.json`);
      writeFileSync(
        artifactPath,
        JSON.stringify(
          {
            contractName: name,
            sourceName: sourceFile,
            abi: contract.abi,
            bytecode: `0x${bytecode}`,
          },
          null,
          2,
        ),
      );
      console.log(`compiled ${name} -> ${artifactPath}`);
      written += 1;
    }
  }

  if (written === 0) {
    throw new Error("Compiled successfully but produced no deployable contracts.");
  }
  console.log(`\nsolc ${solc.version()}`);
}

try {
  main();
} catch (error) {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
}
