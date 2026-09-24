import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Abi, Hex } from "viem";

const require = createRequire(import.meta.url);
const solc = require("solc");

export type CompiledContract = { abi: Abi; bytecode: Hex };

/**
 * Compiles contracts/<name>.sol with the solc version pinned in package.json
 * and returns the contract called <name> in that file. Imports are resolved
 * relative to the project, then from node_modules (e.g. "@openzeppelin/...").
 */
export function compile(name: string): CompiledContract {
  const file = path.join("contracts", `${name}.sol`);
  if (!existsSync(file)) throw new Error(`${file} not found`);

  const input = {
    language: "Solidity",
    sources: { [file]: { content: readFileSync(file, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const findImports = (importPath: string) => {
    for (const candidate of [importPath, path.join("node_modules", importPath)]) {
      if (existsSync(candidate)) return { contents: readFileSync(candidate, "utf8") };
    }
    return { error: `File not found: ${importPath}` };
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  for (const e of output.errors ?? []) console.error(e.formattedMessage);
  if (errors.length > 0) throw new Error(`Compilation of ${file} failed`);

  const contract = output.contracts?.[file]?.[name];
  if (!contract) throw new Error(`No contract named ${name} in ${file}`);
  const bytecode = contract.evm.bytecode.object as string;
  if (!bytecode) throw new Error(`${name} is abstract or an interface; it has no bytecode to deploy`);

  return { abi: contract.abi as Abi, bytecode: `0x${bytecode}` };
}
