/**
 * Deploys a compiled contract to Sepolia and reports the deployed address.
 *
 *   npm run compile
 *   npm run deploy
 *
 * The deployment is recorded in deployments/sepolia.json so the team has a
 * shared record of what is live.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeDeployData, getAddress, type Abi, type Hex } from "viem";
import {
  assertSepolia,
  estimateGasFunded,
  eth,
  explorerAddress,
  explorerTx,
  fail,
  getAccount,
  getWalletClient,
  publicClient,
  rpcUrl,
} from "./config.js";

// ─── Configure your deployment here ──────────────────────────────────────────
/** Contract to deploy. Override for a one-off with `CONTRACT=MyToken npm run deploy`. */
const CONTRACT_NAME = process.env.CONTRACT ?? "Counter";

/** Constructor arguments, in order. Edit to match your contract's constructor. */
const CONSTRUCTOR_ARGS: readonly unknown[] = [0n];
// ─────────────────────────────────────────────────────────────────────────────

const ARTIFACTS_DIR = "artifacts";
const DEPLOYMENTS_FILE = join("deployments", "sepolia.json");

type Artifact = { abi: Abi; bytecode: Hex; contractName: string };

function loadArtifact(name: string): Artifact {
  const path = join(ARTIFACTS_DIR, `${name}.json`);
  if (!existsSync(path)) {
    fail(`No artifact at ${path}. Run \`npm run compile\` first.`);
  }
  const artifact = JSON.parse(readFileSync(path, "utf8")) as Artifact;
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    fail(
      `${name} has no bytecode — abstract contracts and interfaces can't be deployed.`,
    );
  }
  return artifact;
}

function record(entry: Record<string, unknown>): void {
  mkdirSync("deployments", { recursive: true });
  const existing = existsSync(DEPLOYMENTS_FILE)
    ? (JSON.parse(readFileSync(DEPLOYMENTS_FILE, "utf8")) as Record<string, unknown>[])
    : [];
  existing.push(entry);
  writeFileSync(DEPLOYMENTS_FILE, `${JSON.stringify(existing, null, 2)}\n`);
}

async function main(): Promise<void> {
  await assertSepolia();

  const artifact = loadArtifact(CONTRACT_NAME);
  const account = getAccount();
  const wallet = getWalletClient();

  const balance = await publicClient.getBalance({ address: account.address });

  console.log(`\nDeploying ${CONTRACT_NAME} to Sepolia`);
  console.log(`  RPC       ${rpcUrl}`);
  console.log(`  deployer  ${account.address}`);
  console.log(`  balance   ${eth(balance)}`);
  if (CONSTRUCTOR_ARGS.length > 0) {
    console.log(`  args      ${JSON.stringify(CONSTRUCTOR_ARGS, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v)}`);
  }

  if (balance === 0n) {
    fail(
      `Deployer has no Sepolia ETH.\n` +
        `  Fund ${account.address} from a faucet — see the README.`,
    );
  }

  // Price the deployment before sending it, so an underfunded deployer gets a
  // clear message instead of a raw "gas required exceeds allowance" from the RPC.
  const deployData = encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: CONSTRUCTOR_ARGS as never,
  });
  let gas: bigint;
  try {
    gas = await estimateGasFunded({ address: account.address, data: deployData });
  } catch (error) {
    const reason = ((error as Error).message ?? String(error)).split("\n")[0];
    fail(
      `Could not estimate gas for this deployment.\n` +
        `  Most often the deployer simply can't cover it — balance is ${eth(balance)}.\n` +
        `  Fund ${account.address} from a faucet (see the README), or check that\n` +
        `  the constructor arguments in deploy.ts match the contract.\n\n` +
        `  RPC said: ${reason}`,
    );
  }
  const { maxFeePerGas } = await publicClient.estimateFeesPerGas();
  const estimatedCost = gas * maxFeePerGas;

  console.log(`  est. cost ${eth(estimatedCost)} (${gas} gas)`);

  if (balance < estimatedCost) {
    fail(
      `Deployer is underfunded.\n` +
        `  needs about ${eth(estimatedCost)}, has ${eth(balance)}\n` +
        `  Top up ${account.address} from a faucet — see the README.`,
    );
  }

  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: CONSTRUCTOR_ARGS as never,
  });

  console.log(`\n  tx sent   ${hash}`);
  console.log(`            ${explorerTx(hash)}`);
  console.log("  waiting for confirmation…");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success" || !receipt.contractAddress) {
    fail(`Deployment reverted. See ${explorerTx(hash)}`);
  }

  const address = getAddress(receipt.contractAddress);
  const cost = receipt.gasUsed * receipt.effectiveGasPrice;

  console.log(`\n✔ ${CONTRACT_NAME} deployed`);
  console.log(`  address   ${address}`);
  console.log(`  explorer  ${explorerAddress(address)}`);
  console.log(`  block     ${receipt.blockNumber}`);
  console.log(`  gas cost  ${eth(cost)}`);
  console.log(`  remaining ${eth(await publicClient.getBalance({ address: account.address }))}\n`);

  record({
    contract: CONTRACT_NAME,
    address,
    deployer: account.address,
    constructorArgs: CONSTRUCTOR_ARGS.map(String),
    txHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    deployedAt: new Date().toISOString(),
  });
  console.log(`  recorded in ${DEPLOYMENTS_FILE}\n`);
}

main().catch((error: unknown) => {
  fail((error as Error).message ?? String(error));
});
