import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Abi, Hex } from "viem";

export type Artifact = { contractName: string; abi: Abi; bytecode: Hex };

export function loadArtifact(name: string): Artifact {
  const path = join("artifacts", `${name}.json`);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`No artifact at ${path}. Run \`npm run compile\` first.`);
  }
  const artifact = JSON.parse(raw) as Artifact;
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(
      `${name} has empty bytecode — it is an interface or abstract contract.`,
    );
  }
  return artifact;
}
