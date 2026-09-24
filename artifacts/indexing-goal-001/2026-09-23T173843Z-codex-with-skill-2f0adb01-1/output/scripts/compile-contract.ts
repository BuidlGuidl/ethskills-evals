import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const contractPath = path.resolve("contracts/StreakCheckIn.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "StreakCheckIn.sol": {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter(
  (error: { severity: string }) => error.severity === "error",
);

if (errors?.length) {
  console.error(errors);
  process.exit(1);
}

const compiled = output.contracts["StreakCheckIn.sol"].StreakCheckIn;
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/StreakCheckIn.json",
  JSON.stringify(
    {
      abi: compiled.abi,
      bytecode: `0x${compiled.evm.bytecode.object}`,
    },
    null,
    2,
  ),
);

console.log("Wrote artifacts/StreakCheckIn.json");
