/**
 * Compiles a Solidity contract with solc and deploys it to Sepolia with viem.
 *
 *   npm run deploy            # interactive confirmation
 *   npm run deploy -- --yes   # skip confirmation (CI)
 *
 * Config (env / .env): SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY (optional; prompted
 * if unset), CONTRACT_FILE, CONTRACT_NAME, CONSTRUCTOR_ARGS (JSON array).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import solc from "solc";
import { encodeDeployData, formatEther, type Abi, type Hex } from "viem";
import {
  assertSepolia,
  confirm,
  etherscanAddress,
  etherscanTx,
  fail,
  loadDeployer,
  sepoliaClients,
} from "./lib.ts";

const contractFile = process.env.CONTRACT_FILE ?? "contracts/Greeter.sol";
const contractName = process.env.CONTRACT_NAME ?? basename(contractFile, ".sol");

function parseConstructorArgs(): unknown[] {
  const raw = process.env.CONSTRUCTOR_ARGS?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch {
    fail(`CONSTRUCTOR_ARGS must be a JSON array, got: ${raw}`);
  }
}

function compile(): { abi: Abi; bytecode: Hex } {
  const input = {
    language: "Solidity",
    sources: { [contractFile]: { content: readFileSync(contractFile, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  // Resolve imports relative to the project root (e.g. contracts/Foo.sol, node_modules/@openzeppelin/...).
  const findImports = (path: string) => {
    for (const candidate of [path, `node_modules/${path}`]) {
      try {
        return { contents: readFileSync(candidate, "utf8") };
      } catch {}
    }
    return { error: `File not found: ${path}` };
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  for (const e of output.errors ?? []) console.error(e.formattedMessage);
  if (errors.length) fail(`Compilation of ${contractFile} failed.`);

  const contract = output.contracts?.[contractFile]?.[contractName];
  if (!contract) fail(`Contract ${contractName} not found in ${contractFile}.`);
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` };
}

async function main() {
  console.log(`Compiling ${contractName} from ${contractFile} (solc ${solc.version()})...`);
  const { abi, bytecode } = compile();
  const args = parseConstructorArgs();

  const account = await loadDeployer();
  const { publicClient, walletClient } = sepoliaClients(account);
  await assertSepolia(publicClient);

  const data = encodeDeployData({ abi, bytecode, args });
  const [balance, gas, fees] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateGas({ account, data }),
    publicClient.estimateFeesPerGas(),
  ]);
  const maxCost = gas * fees.maxFeePerGas;

  console.log(`
  Network:          Sepolia (chain ${publicClient.chain.id})
  Deployer:         ${account.address}
  Deployer balance: ${formatEther(balance)} ETH
  Contract:         ${contractName}
  Constructor args: ${JSON.stringify(args)}
  Estimated gas:    ${gas}
  Max cost:         ${formatEther(maxCost)} ETH
`);
  if (balance < maxCost) fail("Deployer balance is below the maximum deployment cost.");
  if (!(await confirm("Deploy?"))) fail("Aborted.");

  const hash = await walletClient.sendTransaction({
    data,
    gas: (gas * 120n) / 100n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`Sent: ${etherscanTx(hash)}\nWaiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) fail(`Deployment reverted in tx ${hash}.`);

  const record = {
    network: "sepolia",
    chainId: publicClient.chain.id,
    contract: contractName,
    address: receipt.contractAddress,
    deployer: account.address,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
    constructorArgs: args,
    deployedAt: new Date().toISOString(),
    abi,
  };
  mkdirSync("deployments", { recursive: true });
  const outFile = `deployments/sepolia-${contractName}.json`;
  writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");

  console.log(`
Deployed ${contractName} at ${receipt.contractAddress}
  Block:    ${receipt.blockNumber}
  Gas used: ${receipt.gasUsed}
  Explorer: ${etherscanAddress(receipt.contractAddress)}
  Saved:    ${outFile}
`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
