/**
 * Deploys a contract from contracts/ to Sepolia and reports its address.
 *
 *   npm run deploy
 *
 * Reads SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, CONTRACT and CONSTRUCTOR_ARGS
 * from .env. The deployment record is written to deployments/sepolia.json.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { encodeDeployData, formatEther, getAddress, type Abi } from "viem";
import { compile } from "./lib/compile.js";
import {
  deployerAccount,
  explorerAddress,
  explorerTx,
  fail,
  publicClient,
  rpcUrl,
  walletClient,
} from "./lib/config.js";

const DEPLOYMENTS_FILE = resolve(process.cwd(), "deployments/sepolia.json");

function constructorArgs(): unknown[] {
  const raw = process.env.CONSTRUCTOR_ARGS?.trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail(`CONSTRUCTOR_ARGS is not valid JSON: ${raw}`);
  }
  if (!Array.isArray(parsed)) {
    return fail(`CONSTRUCTOR_ARGS must be a JSON array, e.g. [42]. Got: ${raw}`);
  }
  return parsed;
}

/** Records the deployment so teammates can find the address later. */
function record(entry: Record<string, unknown>) {
  mkdirSync(resolve(process.cwd(), "deployments"), { recursive: true });
  const all: Record<string, unknown> = existsSync(DEPLOYMENTS_FILE)
    ? JSON.parse(readFileSync(DEPLOYMENTS_FILE, "utf8"))
    : {};
  all[entry.contractName as string] = entry;
  writeFileSync(DEPLOYMENTS_FILE, `${JSON.stringify(all, null, 2)}\n`);
}

async function main() {
  const contractName = process.env.CONTRACT?.trim() || "Counter";
  const args = constructorArgs();
  const account = deployerAccount();
  const client = publicClient();
  const wallet = walletClient();

  console.log(`Network   sepolia (${rpcUrl().replace(/\/[\w-]{20,}$/, "/***")})`);
  console.log(`Deployer  ${account.address}`);

  const chainId = await client.getChainId();
  if (chainId !== 11155111) {
    fail(`SEPOLIA_RPC_URL points at chain ${chainId}, not Sepolia (11155111).`);
  }

  const balance = await client.getBalance({ address: account.address });
  console.log(`Balance   ${formatEther(balance)} ETH`);
  if (balance === 0n) {
    fail(
      `Deployer has no Sepolia ETH.\n` +
        `  Fund ${account.address} from a faucet, e.g.\n` +
        `  https://www.alchemy.com/faucets/ethereum-sepolia`,
    );
  }

  console.log(`\nCompiling ${contractName}...`);
  const artifact = compile(contractName);
  console.log(`  ${artifact.compiler}`);
  console.log(`  bytecode ${(artifact.bytecode.length - 2) / 2} bytes`);
  if (args.length > 0) console.log(`  args ${JSON.stringify(args)}`);

  // Encoding here fails fast if the args do not match the constructor,
  // and the estimate catches a deploy that would revert before we pay for it.
  const data = encodeDeployData({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode,
    args,
  });
  const gas = await client.estimateGas({ account, data });
  console.log(`  estimated gas ${gas}`);

  console.log(`\nDeploying...`);
  const hash = await wallet.deployContract({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode,
    args,
  });
  console.log(`  tx ${explorerTx(hash)}`);

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    fail(`Deploy transaction reverted. See ${explorerTx(hash)}`);
  }

  const address = getAddress(receipt.contractAddress);
  const cost = receipt.gasUsed * receipt.effectiveGasPrice;

  console.log(`\n✔ ${contractName} deployed`);
  console.log(`  address  ${address}`);
  console.log(`  block    ${receipt.blockNumber}`);
  console.log(`  gas used ${receipt.gasUsed} (${formatEther(cost)} ETH)`);
  console.log(`  explorer ${explorerAddress(address)}`);

  record({
    contractName,
    address,
    txHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    deployer: account.address,
    constructorArgs: args,
    compiler: artifact.compiler,
    deployedAt: new Date().toISOString(),
  });
  console.log(`\n  recorded in deployments/sepolia.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
