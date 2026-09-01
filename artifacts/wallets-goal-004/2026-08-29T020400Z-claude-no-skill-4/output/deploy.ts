import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BaseError,
  encodeDeployData,
  formatEther,
  getAddress,
  type Abi,
  type Hex,
} from "viem";
import { compile } from "./compile.js";
import {
  chain,
  deployerAccount,
  explorer,
  publicClient,
  reportAndExit,
  walletClient,
} from "./config.js";

/**
 * Deploys a contract to Sepolia and prints its address.
 *
 *   npm run deploy
 *
 * To ship a different contract, drop the .sol file in contracts/ and change
 * CONTRACT_NAME (or set CONTRACT_NAME in the environment for a one-off).
 */

const CONTRACT_NAME = process.env.CONTRACT_NAME ?? "Counter";

/** Constructor arguments, in order. Counter takes a starting count. */
const CONSTRUCTOR_ARGS: readonly unknown[] = [0n];

type Artifact = { contractName: string; abi: Abi; bytecode: Hex };

function loadArtifact(name: string): Artifact {
  const path = resolve("artifacts", `${name}.json`);
  if (!existsSync(path)) {
    console.log(`No artifact for ${name}, compiling...`);
    compile();
  }
  if (!existsSync(path)) {
    throw new Error(
      `Still no artifacts/${name}.json after compiling. Check that ` +
        `contracts/ contains a contract named exactly "${name}".`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as Artifact;
}

async function main(): Promise<void> {
  const account = deployerAccount();
  const artifact = loadArtifact(CONTRACT_NAME);
  const client = publicClient();
  const wallet = walletClient(account);

  console.log(`\nDeploying ${artifact.contractName} to ${chain.name}`);
  console.log(`  deployer: ${account.address}`);

  const balance = await client.getBalance({ address: account.address });
  console.log(`  balance:  ${formatEther(balance)} ETH`);
  if (balance === 0n) {
    throw new Error(
      `Deployer ${account.address} has no Sepolia ETH. Fund it from a faucet ` +
        `(see README) or from the team account, then run this again.`,
    );
  }

  // Estimate first so an underfunded or reverting deploy fails before we spend
  // anything, with a readable reason.
  let gas: bigint;
  try {
    gas = await client.estimateGas({
      account,
      data: encodeDeployData({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: CONSTRUCTOR_ARGS as unknown[],
      }),
    });
  } catch (error) {
    const detail = error instanceof BaseError ? error.shortMessage : String(error);
    throw new Error(
      `Could not estimate gas for the deploy. The usual causes are a deployer ` +
        `balance too small to cover gas (currently ${formatEther(balance)} ETH) ` +
        `or a constructor that reverts.\n  RPC said: ${detail}`,
    );
  }
  const fees = await client.estimateFeesPerGas();
  const maxCost = gas * (fees.maxFeePerGas ?? 0n);
  console.log(`  gas:      ${gas} units, up to ~${formatEther(maxCost)} ETH`);

  if (maxCost > balance) {
    throw new Error(
      `Deploy could cost up to ${formatEther(maxCost)} ETH but the deployer ` +
        `only holds ${formatEther(balance)} ETH. Top it up and retry.`,
    );
  }

  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: CONSTRUCTOR_ARGS as unknown[],
    account,
    chain,
  });
  console.log(`\n  tx sent: ${explorer}/tx/${hash}`);
  console.log("  waiting for confirmation...");

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deploy transaction reverted: ${explorer}/tx/${hash}`);
  }

  const spent = receipt.gasUsed * receipt.effectiveGasPrice;
  const address = getAddress(receipt.contractAddress);
  console.log(`\n${artifact.contractName} deployed`);
  console.log(`  address:  ${address}`);
  console.log(`  block:    ${receipt.blockNumber}`);
  console.log(`  cost:     ${formatEther(spent)} ETH`);
  console.log(`  explorer: ${explorer}/address/${address}\n`);
  console.log("Leftover deployer funds can be returned with: npm run sweep\n");
}

main().catch(reportAndExit);
