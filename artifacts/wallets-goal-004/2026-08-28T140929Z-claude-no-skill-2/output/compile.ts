/**
 * Compiles contracts/*.sol with solc and writes artifacts/<Name>.json
 * ({ abi, bytecode }) for deploy.ts to consume.
 *
 *   npm run compile
 *
 * The solc version is pinned in package.json, so everyone on the team produces
 * identical bytecode from identical sources.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("solc");

const root = dirname(fileURLToPath(import.meta.url));
const contractsDir = join(root, "contracts");
const artifactsDir = join(root, "artifacts");

export interface Artifact {
  contractName: string;
  sourceName: string;
  abi: unknown[];
  bytecode: `0x${string}`;
  compiler: string;
}

interface SolcError {
  severity: "error" | "warning" | "info";
  formattedMessage: string;
}

/** Lets contracts import from node_modules (e.g. OpenZeppelin) and from contracts/. */
function findImport(path: string): { contents: string } | { error: string } {
  for (const base of [contractsDir, join(root, "node_modules"), root]) {
    const candidate = resolve(base, path);
    if (existsSync(candidate)) return { contents: readFileSync(candidate, "utf8") };
  }
  return { error: `File not found: ${path}` };
}

export function compile(): Map<string, Artifact> {
  const sources: Record<string, { content: string }> = {};
  for (const file of readdirSync(contractsDir).filter((f) => f.endsWith(".sol"))) {
    sources[file] = { content: readFileSync(join(contractsDir, file), "utf8") };
  }
  if (Object.keys(sources).length === 0) {
    throw new Error(`No .sol files found in ${contractsDir}`);
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "metadata"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

  const diagnostics: SolcError[] = output.errors ?? [];
  for (const err of diagnostics.filter((e) => e.severity !== "error")) {
    console.warn(err.formattedMessage);
  }
  const fatal = diagnostics.filter((e) => e.severity === "error");
  if (fatal.length > 0) {
    throw new Error(`Solidity compilation failed:\n\n${fatal.map((e) => e.formattedMessage).join("\n")}`);
  }

  mkdirSync(artifactsDir, { recursive: true });
  const artifacts = new Map<string, Artifact>();

  for (const [sourceName, contracts] of Object.entries<Record<string, any>>(output.contracts ?? {})) {
    for (const [contractName, contract] of Object.entries<any>(contracts)) {
      const bytecode = `0x${contract.evm.bytecode.object}` as const;
      // Interfaces, libraries and abstract contracts compile to empty bytecode.
      if (bytecode === "0x") continue;

      const artifact: Artifact = {
        contractName,
        sourceName,
        abi: contract.abi,
        bytecode,
        compiler: solc.version(),
      };
      writeFileSync(join(artifactsDir, `${contractName}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
      artifacts.set(contractName, artifact);
    }
  }
  return artifacts;
}

export function loadArtifact(contractName: string): Artifact {
  const artifacts = compile();
  const artifact = artifacts.get(contractName);
  if (!artifact) {
    throw new Error(
      `No deployable contract named "${contractName}". Compiled: ${[...artifacts.keys()].join(", ") || "(none)"}.`,
    );
  }
  return artifact;
}

// `npm run compile` runs this file directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artifacts = compile();
  console.log(`Compiled with solc ${solc.version()}`);
  for (const a of artifacts.values()) {
    const sizeKb = ((a.bytecode.length - 2) / 2 / 1024).toFixed(2);
    console.log(`  ${a.contractName.padEnd(24)} ${sizeKb} KB  → artifacts/${a.contractName}.json`);
  }
}
