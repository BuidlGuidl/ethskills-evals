/**
 * Deploys a compiled contract to Sepolia and reports the address.
 *
 *   npm run compile
 *   npm run deploy
 *
 * Reads DEPLOYER_PRIVATE_KEY and SEPOLIA_RPC_URL from .env (see .env.example).
 * Estimates gas live, shows you the cost, and waits for you to type "yes"
 * before broadcasting.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  formatEther,
  getAddress,
  http,
} from "viem";
import { sepolia } from "viem/chains";
import { deployerAccount, rpcUrl, address } from "./src/env.js";
import { loadArtifact } from "./src/artifact.js";
import { confirmSpend } from "./src/confirm.js";

// ── Edit these two when you swap in the real contract ────────────────────────
const CONTRACT_NAME = process.env.CONTRACT_NAME ?? "Counter";

/** Constructor arguments, in order. Empty array if the constructor takes none. */
function constructorArgs() {
  // Counter(address initialOwner) — hand ownership straight to the team Safe
  // so the hot deploy key is not left holding admin rights.
  return [address("CONTRACT_OWNER")] as const;
}
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const account = deployerAccount();
  const artifact = loadArtifact(CONTRACT_NAME);
  const transport = http(rpcUrl());

  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(
      `SEPOLIA_RPC_URL points at chain ${chainId}, not Sepolia (${sepolia.id}).`,
    );
  }

  const args = constructorArgs();
  const data = encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: args as unknown as never,
  });

  const [balance, gasEstimate, fees] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateGas({ account, data }),
    publicClient.estimateFeesPerGas(),
  ]);

  // 20% headroom on the estimate; the unused portion is refunded.
  const gasLimit = (gasEstimate * 120n) / 100n;
  const gasCost = gasLimit * fees.maxFeePerGas;

  console.log(`contract:  ${artifact.contractName}`);
  console.log(`args:      ${args.length ? args.join(", ") : "(none)"}`);
  console.log(`deployer:  ${account.address}`);
  console.log(`balance:   ${formatEther(balance)} ETH`);

  if (balance < gasCost) {
    throw new Error(
      `Deployer holds ${formatEther(balance)} ETH but the deploy may cost up ` +
        `to ${formatEther(gasCost)} ETH. Top it up from a Sepolia faucet.`,
    );
  }

  await confirmSpend({
    action: `Deploy ${artifact.contractName} to Sepolia`,
    to: "new contract",
    gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    gasCost,
  });

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: args as unknown as never,
    gas: gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`\nsent:      ${hash}`);
  console.log("waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deploy reverted. Receipt status: ${receipt.status}`);
  }

  const contractAddress = getAddress(receipt.contractAddress);
  const spent = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log(`\n✔ ${artifact.contractName} deployed`);
  console.log(`  address:  ${contractAddress}`);
  console.log(`  block:    ${receipt.blockNumber}`);
  console.log(`  gas used: ${receipt.gasUsed} (${formatEther(spent)} ETH)`);
  console.log(
    `  explorer: https://sepolia.etherscan.io/address/${contractAddress}`,
  );

  const record = {
    contractName: artifact.contractName,
    address: contractAddress,
    chainId: sepolia.id,
    constructorArgs: args.map(String),
    deployer: account.address,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    deployedAt: new Date().toISOString(),
  };
  mkdirSync("deployments", { recursive: true });
  const path = `deployments/sepolia-${artifact.contractName}.json`;
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\nRecorded in ${path} — commit it so the team shares one address.`);
}

main().catch((error) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
