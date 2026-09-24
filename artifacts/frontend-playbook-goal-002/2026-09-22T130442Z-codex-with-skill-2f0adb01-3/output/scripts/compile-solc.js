const fs = require("fs");
const path = require("path");
const solc = require("solc");

const root = path.join(__dirname, "..");
const contractsDir = path.join(root, "contracts");
const artifactsDir = path.join(root, "artifacts", "contracts");

function findSolidityFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findSolidityFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".sol") ? [fullPath] : [];
  });
}

const sources = Object.fromEntries(
  findSolidityFiles(contractsDir).map((filePath) => {
    const sourceName = path.relative(root, filePath).split(path.sep).join("/");
    return [sourceName, { content: fs.readFileSync(filePath, "utf8") }];
  }),
);

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors || [];

for (const error of errors) {
  const message = error.formattedMessage || error.message;
  if (error.severity === "error") console.error(message);
  else console.warn(message);
}

if (errors.some((error) => error.severity === "error")) {
  process.exit(1);
}

fs.rmSync(path.join(root, "artifacts"), { force: true, recursive: true });

for (const [sourceName, contracts] of Object.entries(output.contracts)) {
  const sourceOutDir = path.join(artifactsDir, sourceName);
  fs.mkdirSync(sourceOutDir, { recursive: true });

  for (const [contractName, contract] of Object.entries(contracts)) {
    const artifact = {
      _format: "hh-sol-artifact-1",
      contractName,
      sourceName,
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
      deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
      linkReferences: contract.evm.bytecode.linkReferences || {},
      deployedLinkReferences: contract.evm.deployedBytecode.linkReferences || {},
    };

    fs.writeFileSync(path.join(sourceOutDir, `${contractName}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
  }
}

console.log(`Compiled ${Object.keys(sources).length} Solidity files with solc ${solc.version()}.`);
