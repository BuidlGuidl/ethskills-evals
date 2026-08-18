// Thin wrapper around the Noir/Barretenberg CLI: inputs in, EVM-ready proof out.
//
// Everything here runs on the member's own machine. The secret is written into
// circuits/<name>/Prover.toml for the duration of witness generation and never
// leaves the process otherwise.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const toml = (inputs) =>
  Object.entries(inputs)
    .map(([k, v]) => (Array.isArray(v) ? `${k} = [${v.map((x) => `"${x}"`).join(", ")}]` : `${k} = "${v}"`))
    .join("\n") + "\n";

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${err.stderr || err.stdout || err.message}`);
  }
}

/**
 * Prove `circuits/<name>` over `inputs` and return the calldata the contracts want.
 * @returns {{proof: string, publicInputs: string[]}}
 */
export function proveCircuit(name, inputs) {
  const dir = join(ROOT, "circuits", name);
  if (!existsSync(join(dir, "target", `${name}.json`)) || !existsSync(join(dir, "target", "vk"))) {
    throw new Error(`circuits/${name} is not built — run ./scripts/build-circuits.sh first`);
  }

  writeFileSync(join(dir, "Prover.toml"), toml(inputs));
  run("nargo", ["execute", "witness", "--silence-warnings"], dir);
  run(
    "bb",
    // -t evm: keccak transcript + the zero-knowledge variant of UltraHonk.
    // The ZK variant matters here: a non-ZK proof can leak witness data, and
    // the witness is the member's identity.
    ["prove", "-b", `target/${name}.json`, "-w", "target/witness.gz", "-k", "target/vk", "-t", "evm", "-o", "target/proof"],
    dir,
  );

  const proof = readFileSync(join(dir, "target", "proof", "proof"));
  const publicInputs = readFileSync(join(dir, "target", "proof", "public_inputs"));

  const fields = [];
  for (let i = 0; i < publicInputs.length; i += 32) {
    fields.push("0x" + publicInputs.subarray(i, i + 32).toString("hex"));
  }
  return { proof: "0x" + proof.toString("hex"), publicInputs: fields };
}
