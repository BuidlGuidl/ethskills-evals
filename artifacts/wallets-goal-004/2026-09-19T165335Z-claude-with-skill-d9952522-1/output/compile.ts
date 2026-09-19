import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import solc from "solc";
import type { Abi, Hex } from "viem";

/** Compiles one Solidity file with solc-js and returns the ABI + creation bytecode of `contractName`. */
export function compile(file: string, contractName: string): { abi: Abi; bytecode: Hex } {
  const input = {
    language: "Solidity",
    sources: { [file]: { content: readFileSync(file, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  // Resolve relative imports (e.g. "./Lib.sol") from the contract's directory or node_modules.
  const findImports = (path: string) => {
    for (const candidate of [resolve(dirname(file), path), resolve(path), resolve("node_modules", path)]) {
      try {
        return { contents: readFileSync(candidate, "utf8") };
      } catch {}
    }
    return { error: `Import not found: ${path}` };
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (output.errors ?? []).filter((e: any) => e.severity === "error");
  for (const e of output.errors ?? []) console.error(e.formattedMessage);
  if (errors.length) throw new Error("Compilation failed.");

  const contract = output.contracts?.[file]?.[contractName];
  if (!contract) throw new Error(`Contract ${contractName} not found in ${file}.`);
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` };
}
