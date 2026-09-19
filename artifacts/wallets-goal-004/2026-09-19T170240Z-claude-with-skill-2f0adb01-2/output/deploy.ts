/**
 * Compile a Solidity contract and deploy it to Sepolia with viem.
 *
 *   npm run deploy -- contracts/MyContract.sol:MyContract
 *   npm run deploy -- contracts/MyToken.sol:MyToken --args '["Name", "SYM", 1000000]'
 *
 * Flags:
 *   --args '<json array>'   constructor arguments (big numbers as strings are fine)
 *   --yes                   skip the confirmation prompt (e.g. in CI)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { encodeDeployData, formatEther, getAddress, type Abi, type Hex } from "viem";
import { addressUrl, assertSepolia, confirm, getClients, txUrl } from "./lib/env.ts";

const require = createRequire(import.meta.url);
const solc = require("solc");

function parseCli() {
  const argv = process.argv.slice(2);
  const argsIdx = argv.indexOf("--args");
  const target = argv.find((a, i) => !a.startsWith("--") && (argsIdx === -1 || i !== argsIdx + 1));
  if (!target || !target.includes(":")) {
    throw new Error("Usage: npm run deploy -- <path/to/File.sol>:<ContractName> [--args '<json>'] [--yes]");
  }
  const [file, contractName] = target.split(":");
  const args: unknown[] = argsIdx === -1 ? [] : JSON.parse(argv[argsIdx + 1] ?? "[]");
  if (!Array.isArray(args)) throw new Error("--args must be a JSON array");
  return { file, contractName, args };
}

function compile(file: string, contractName: string): { abi: Abi; bytecode: Hex } {
  if (!existsSync(file)) throw new Error(`Contract file not found: ${file}`);
  const source = path.normalize(file);

  const input = {
    language: "Solidity",
    sources: { [source]: { content: readFileSync(source, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  // Resolve imports relative to the repo and node_modules (e.g. @openzeppelin/...).
  const findImports = (importPath: string) => {
    for (const candidate of [importPath, path.join("node_modules", importPath)]) {
      if (existsSync(candidate)) return { contents: readFileSync(candidate, "utf8") };
    }
    return { error: `Import not found: ${importPath}` };
  };

  console.log(`Compiling ${source} with solc ${solc.version()}...`);
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  const errors = (output.errors ?? []).filter((e: any) => e.severity === "error");
  for (const e of output.errors ?? []) console.error(e.formattedMessage);
  if (errors.length) throw new Error("Compilation failed.");

  const contract = output.contracts?.[source]?.[contractName];
  if (!contract) throw new Error(`Contract ${contractName} not found in ${source}`);
  const bytecode = `0x${contract.evm.bytecode.object}` as Hex;
  if (bytecode === "0x") throw new Error(`${contractName} is abstract or an interface; nothing to deploy.`);
  return { abi: contract.abi, bytecode };
}

async function main() {
  const { file, contractName, args } = parseCli();
  const { abi, bytecode } = compile(file, contractName);

  const { account, publicClient, walletClient } = getClients();
  await assertSepolia(publicClient);

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) {
    throw new Error(`Deployer ${account.address} has no Sepolia ETH. Fund it first.`);
  }
  const gas = await publicClient.estimateGas({
    account,
    data: encodeDeployData({ abi, bytecode, args }),
  });
  const fees = await publicClient.estimateFeesPerGas();
  const maxCost = gas * fees.maxFeePerGas;

  console.log(`
  Network:        Sepolia (${publicClient.chain.id})
  Deployer:       ${account.address}
  Balance:        ${formatEther(balance)} ETH
  Contract:       ${contractName}
  Constructor:    ${JSON.stringify(args)}
  Estimated gas:  ${gas}
  Max cost:       ${formatEther(maxCost)} ETH
`);
  if (balance < maxCost) {
    throw new Error("Deployer balance is too low for this deploy. Fund it with Sepolia ETH first.");
  }
  if (!(await confirm("Deploy?"))) {
    console.log("Aborted, nothing sent.");
    return;
  }

  const hash = await walletClient.deployContract({ abi, bytecode, args });
  console.log(`Sent: ${txUrl(hash)}\nWaiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deployment reverted in block ${receipt.blockNumber}: ${txUrl(hash)}`);
  }

  const address = getAddress(receipt.contractAddress);
  const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log(`
✅ ${contractName} deployed
  Address:   ${address}
  Explorer:  ${addressUrl(address)}
  Block:     ${receipt.blockNumber}
  Gas cost:  ${formatEther(gasCost)} ETH
`);

  // Public record of what was deployed (addresses and tx hashes only; no secrets).
  mkdirSync("deployments", { recursive: true });
  const recordPath = path.join("deployments", "sepolia.json");
  const records = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, "utf8")) : {};
  records[contractName] = {
    address,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
    deployer: account.address,
    constructorArgs: args,
    deployedAt: new Date().toISOString(),
    abi,
  };
  writeFileSync(recordPath, JSON.stringify(records, null, 2) + "\n");
  console.log(`Saved to ${recordPath}. Run \`npm run sweep\` to return leftover ETH to the team account.`);
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
