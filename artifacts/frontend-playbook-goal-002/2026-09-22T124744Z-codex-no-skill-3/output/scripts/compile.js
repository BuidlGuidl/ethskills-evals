const fs = require("fs");
const path = require("path");
const solc = require("solc");

const root = path.join(__dirname, "..");
const contractsDir = path.join(root, "contracts");
const artifactsDir = path.join(root, "artifacts", "contracts");

const sourceFiles = fs
  .readdirSync(contractsDir)
  .filter((file) => file.endsWith(".sol"))
  .map((file) => path.join("contracts", file));

const sources = Object.fromEntries(
  sourceFiles.map((sourcePath) => [
    sourcePath,
    { content: fs.readFileSync(path.join(root, sourcePath), "utf8") }
  ])
);

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"]
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors ?? [];

for (const error of errors) {
  const stream = error.severity === "error" ? process.stderr : process.stdout;
  stream.write(`${error.formattedMessage}\n`);
}

if (errors.some((error) => error.severity === "error")) {
  process.exit(1);
}

fs.rmSync(artifactsDir, { recursive: true, force: true });

for (const [sourceName, contracts] of Object.entries(output.contracts)) {
  const sourceArtifactDir = path.join(root, "artifacts", sourceName);
  fs.mkdirSync(sourceArtifactDir, { recursive: true });

  for (const [contractName, contractOutput] of Object.entries(contracts)) {
    const artifact = {
      _format: "hh-sol-artifact-1",
      contractName,
      sourceName,
      abi: contractOutput.abi,
      bytecode: `0x${contractOutput.evm.bytecode.object}`,
      deployedBytecode: `0x${contractOutput.evm.deployedBytecode.object}`,
      linkReferences: contractOutput.evm.bytecode.linkReferences ?? {},
      deployedLinkReferences: contractOutput.evm.deployedBytecode.linkReferences ?? {}
    };

    fs.writeFileSync(
      path.join(sourceArtifactDir, `${contractName}.json`),
      `${JSON.stringify(artifact, null, 2)}\n`
    );
  }
}

console.log(`Compiled ${sourceFiles.length} Solidity files with solc ${solc.version()}`);
