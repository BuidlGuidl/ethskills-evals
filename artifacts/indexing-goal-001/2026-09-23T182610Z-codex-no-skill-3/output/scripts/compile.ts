import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import solc from "solc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const contractPath = path.join(root, "contracts", "StreakCheckIn.sol");

export type CompiledContract = {
  abi: unknown[];
  bytecode: `0x${string}`;
};

export function compileStreakContract(): CompiledContract {
  const source = fs.readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "StreakCheckIn.sol": { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    errors?: Array<{ severity: string; formattedMessage: string }>;
    contracts: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
  };

  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  }

  const contract = output.contracts["StreakCheckIn.sol"]?.StreakCheckIn;
  if (!contract) {
    throw new Error("StreakCheckIn contract was not emitted by solc");
  }

  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

function writeArtifact(compiled: CompiledContract) {
  const artifactDir = path.join(root, "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactDir, "StreakCheckIn.json"),
    `${JSON.stringify(compiled, null, 2)}\n`,
    "utf8",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const compiled = compileStreakContract();
  writeArtifact(compiled);
  console.log("Wrote artifacts/StreakCheckIn.json");
}
