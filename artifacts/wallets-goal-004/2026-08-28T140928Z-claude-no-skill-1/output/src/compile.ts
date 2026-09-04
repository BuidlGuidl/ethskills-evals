import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import type { Abi, Hex } from "viem";
import { UserError } from "./config.js";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CONTRACTS_DIR = join(ROOT, "contracts");
const ARTIFACTS_DIR = join(ROOT, "artifacts");
const NODE_MODULES = join(ROOT, "node_modules");

/** EIP-170 max deployed bytecode size. */
const MAX_CONTRACT_SIZE = 24_576;

export interface Artifact {
  contractName: string;
  sourceName: string;
  compiler: string;
  abi: Abi;
  bytecode: Hex;
}

/**
 * Resolve `import` statements for solc: first relative to contracts/, then
 * node_modules/ (so `@openzeppelin/contracts/...` just works), then repo root.
 */
function findImports(path: string): { contents: string } | { error: string } {
  for (const base of [CONTRACTS_DIR, NODE_MODULES, ROOT]) {
    const candidate = join(base, path);
    if (existsSync(candidate)) {
      return { contents: readFileSync(candidate, "utf8") };
    }
  }
  return { error: `Could not resolve import "${path}"` };
}

/**
 * Compile `contracts/<contractName>.sol` and write `artifacts/<contractName>.json`.
 * Returns the ABI and creation bytecode ready to hand to viem.
 */
export function compile(contractName: string): Artifact {
  const sourceName = `${contractName}.sol`;
  const sourcePath = join(CONTRACTS_DIR, sourceName);

  if (!existsSync(sourcePath)) {
    throw new UserError(
      `No contract at contracts/${sourceName}. ` +
        "Set CONTRACT_NAME in .env to the contract you want to deploy.",
    );
  }

  const input = {
    language: "Solidity",
    sources: { [sourceName]: { content: readFileSync(sourcePath, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
      },
    },
  };

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  );

  const diagnostics: { severity: string; formattedMessage: string }[] =
    output.errors ?? [];
  const errors = diagnostics.filter((e) => e.severity === "error");
  for (const warning of diagnostics.filter((e) => e.severity !== "error")) {
    console.warn(warning.formattedMessage);
  }
  if (errors.length > 0) {
    throw new UserError(
      "Solidity compilation failed:\n" +
        errors.map((e) => e.formattedMessage).join("\n"),
    );
  }

  const compiled = output.contracts?.[sourceName]?.[contractName];
  if (!compiled) {
    const found = Object.keys(output.contracts?.[sourceName] ?? {});
    throw new UserError(
      `contracts/${sourceName} does not define a contract named "${contractName}". ` +
        (found.length ? `Found: ${found.join(", ")}.` : ""),
    );
  }

  const bytecode = compiled.evm.bytecode.object as string;
  if (!bytecode) {
    throw new UserError(
      `"${contractName}" produced no bytecode — is it an interface or abstract contract?`,
    );
  }

  const deployedSize = (compiled.evm.deployedBytecode?.object?.length ?? 0) / 2;
  if (deployedSize > MAX_CONTRACT_SIZE) {
    console.warn(
      `⚠ ${contractName} is ${deployedSize} bytes, over the ${MAX_CONTRACT_SIZE}-byte ` +
        "EIP-170 limit. The deploy will revert.",
    );
  }

  const artifact: Artifact = {
    contractName,
    sourceName,
    compiler: solc.version(),
    abi: compiled.abi as Abi,
    bytecode: `0x${bytecode}`,
  };

  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(
    join(ARTIFACTS_DIR, `${contractName}.json`),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );

  return artifact;
}
