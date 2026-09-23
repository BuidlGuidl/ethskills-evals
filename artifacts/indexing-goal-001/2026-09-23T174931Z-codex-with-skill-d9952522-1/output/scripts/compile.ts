import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import solc from "solc";

const contractPath = path.resolve("contracts/StreakCheckIn.sol");
const artifactPath = path.resolve("artifacts/StreakCheckIn.json");

export type CompiledContract = {
  abi: unknown[];
  bytecode: `0x${string}`;
};

export async function compileStreakCheckIn(): Promise<CompiledContract> {
  const source = await readFile(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "StreakCheckIn.sol": {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((error: { severity: string }) => error.severity === "error");
  if (errors?.length > 0) {
    throw new Error(errors.map((error: { formattedMessage: string }) => error.formattedMessage).join("\n"));
  }

  const contract = output.contracts["StreakCheckIn.sol"].StreakCheckIn;
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

export async function writeArtifact() {
  const compiled = await compileStreakCheckIn();
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(compiled, null, 2)}\n`);
  return artifactPath;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const writtenPath = await writeArtifact();
  console.log(`Wrote ${path.relative(process.cwd(), writtenPath)}`);
}
