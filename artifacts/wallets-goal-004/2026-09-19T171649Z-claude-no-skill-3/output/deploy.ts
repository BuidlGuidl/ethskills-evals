/**
 * Compile a Solidity contract with solc-js and deploy it to Sepolia with viem.
 *
 *   npm run deploy            # asks for confirmation
 *   npm run deploy -- --yes   # non-interactive
 *
 * Config comes from .env (see .env.example).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { encodeDeployData, formatEther, type Abi, type Hex } from "viem";
import { confirm, explorer, makeClients, requireEnv } from "./common.ts";

const require = createRequire(import.meta.url);
const solc = require("solc");

function compile(contractPath: string, contractName: string): { abi: Abi; bytecode: Hex } {
  const source = path.normalize(contractPath);
  const input = {
    language: "Solidity",
    sources: { [source]: { content: readFileSync(source, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  // Resolve imports relative to the project, then node_modules (e.g. @openzeppelin/...).
  const findImports = (importPath: string) => {
    for (const candidate of [importPath, path.join("node_modules", importPath)]) {
      try {
        return { contents: readFileSync(candidate, "utf8") };
      } catch {}
    }
    return { error: `File not found: ${importPath}` };
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (output.errors ?? []).filter((e: any) => e.severity === "error");
  for (const e of output.errors ?? []) console.error(e.formattedMessage);
  if (errors.length) throw new Error("Compilation failed.");

  const artifact = output.contracts?.[source]?.[contractName];
  if (!artifact) throw new Error(`Contract ${contractName} not found in ${source}.`);
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` };
}

async function main() {
  const contractPath = requireEnv("CONTRACT_PATH");
  const contractName = requireEnv("CONTRACT_NAME");
  const args = JSON.parse(process.env.CONSTRUCTOR_ARGS?.trim() || "[]");
  if (!Array.isArray(args)) throw new Error("CONSTRUCTOR_ARGS must be a JSON array.");

  console.log(`Compiling ${contractName} from ${contractPath} (solc ${solc.version()})...`);
  const { abi, bytecode } = compile(contractPath, contractName);

  const { account, publicClient, walletClient } = await makeClients();
  const balance = await publicClient.getBalance({ address: account.address });
  const gas = await publicClient.estimateGas({
    account,
    data: encodeDeployData({ abi, bytecode, args }),
  });
  const { maxFeePerGas } = await publicClient.estimateFeesPerGas();
  const worstCaseCost = gas * maxFeePerGas;

  console.log(`Network:     Sepolia`);
  console.log(`Deployer:    ${account.address}`);
  console.log(`Balance:     ${formatEther(balance)} ETH`);
  console.log(`Constructor: ${JSON.stringify(args)}`);
  console.log(`Est. gas:    ${gas} (max cost ~${formatEther(worstCaseCost)} ETH)`);
  if (balance < worstCaseCost) {
    console.error("Deployer balance is too low for this deployment.");
    process.exit(1);
  }
  if (!(await confirm(`Deploy ${contractName} to Sepolia?`))) {
    console.log("Aborted.");
    return;
  }

  const hash = await walletClient.deployContract({ abi, bytecode, args });
  console.log(`Sent tx ${hash}\n  ${explorer(`tx/${hash}`)}\nWaiting for confirmation...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deployment reverted in block ${receipt.blockNumber}.`);
  }

  const record = {
    contract: contractName,
    source: contractPath,
    address: receipt.contractAddress,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
    deployer: account.address,
    constructorArgs: args,
    solcVersion: solc.version(),
    deployedAt: new Date().toISOString(),
  };
  mkdirSync("deployments", { recursive: true });
  const outFile = path.join("deployments", `sepolia-${contractName}.json`);
  writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");

  console.log(`\nDeployed ${contractName} at ${receipt.contractAddress}`);
  console.log(`  ${explorer(`address/${receipt.contractAddress}`)}`);
  console.log(`  Gas used: ${receipt.gasUsed}`);
  console.log(`  Saved to ${outFile} -- commit this file so the team has the address.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
