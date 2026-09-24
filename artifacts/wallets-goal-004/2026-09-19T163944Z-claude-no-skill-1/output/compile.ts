import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import type { Abi, Hex } from "viem";

const root = dirname(fileURLToPath(import.meta.url));
const contractsDir = join(root, "contracts");
const outDir = join(root, "out");

export type Artifact = {
  contractName: string;
  sourceName: string;
  abi: Abi;
  bytecode: Hex;
  compiler: string;
};

// Resolve imports like "@openzeppelin/contracts/..." from node_modules.
function findImports(path: string) {
  for (const base of [contractsDir, join(root, "node_modules")]) {
    const file = resolve(base, path);
    if (existsSync(file)) return { contents: readFileSync(file, "utf8") };
  }
  return { error: `File not found: ${path}` };
}

/** Compiles every .sol file in contracts/ and writes one JSON artifact per contract to out/. */
export function compileAll(): Map<string, Artifact> {
  const sources: Record<string, { content: string }> = {};
  for (const file of readdirSync(contractsDir).filter((f) => f.endsWith(".sol"))) {
    sources[file] = { content: readFileSync(join(contractsDir, file), "utf8") };
  }
  if (Object.keys(sources).length === 0) throw new Error("No .sol files found in contracts/.");

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  const errors = (output.errors ?? []) as { severity: string; formattedMessage: string }[];
  for (const e of errors) console.error(e.formattedMessage);
  if (errors.some((e) => e.severity === "error")) throw new Error("Compilation failed.");

  mkdirSync(outDir, { recursive: true });
  const artifacts = new Map<string, Artifact>();
  for (const [sourceName, contracts] of Object.entries<any>(output.contracts)) {
    for (const [contractName, c] of Object.entries<any>(contracts)) {
      if (!c.evm.bytecode.object) continue; // interfaces / abstract contracts
      if (artifacts.has(contractName)) {
        throw new Error(`Duplicate contract name "${contractName}"; names must be unique.`);
      }
      const artifact: Artifact = {
        contractName,
        sourceName,
        abi: c.abi,
        bytecode: `0x${c.evm.bytecode.object}`,
        compiler: solc.version(),
      };
      artifacts.set(contractName, artifact);
      writeFileSync(join(outDir, `${contractName}.json`), JSON.stringify(artifact, null, 2));
    }
  }
  return artifacts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artifacts = compileAll();
  console.log(`Compiled with solc ${solc.version()}:`);
  for (const a of artifacts.values()) console.log(`  ${a.contractName} (${a.sourceName}) -> out/${a.contractName}.json`);
}
