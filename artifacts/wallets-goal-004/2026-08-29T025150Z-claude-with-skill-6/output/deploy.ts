/**
 * Deploys a compiled contract to Sepolia and prints its address.
 *
 *   npm run compile
 *   npm run deploy                 # deploys Counter with constructor arg 0
 *   npm run deploy -- Counter 42   # <ContractName> [constructor args...]
 *
 * Reads DEPLOYER_PRIVATE_KEY and SEPOLIA_RPC_URL from .env (never from the repo).
 */
import { readFileSync } from "node:fs";
import { BaseError, encodeDeployData, getAddress, type Abi, type Hex } from "viem";
import {
  chain,
  confirm,
  deployerAccount,
  eth,
  explorerAddress,
  explorerTx,
  publicClient,
  walletClient,
} from "./config.js";

type Artifact = { contractName: string; abi: Abi; bytecode: Hex };

const [contractName = "Counter", ...rawArgs] = process.argv.slice(2);

let artifact: Artifact;
try {
  artifact = JSON.parse(readFileSync(`artifacts/${contractName}.json`, "utf8"));
} catch {
  throw new Error(`No artifact for "${contractName}". Run \`npm run compile\` first.`);
}

/** Coerce CLI strings to the types the constructor expects. */
function parseArgs(abi: Abi, args: string[]): unknown[] {
  const ctor = abi.find((item) => item.type === "constructor");
  const inputs = ctor && "inputs" in ctor ? ctor.inputs : [];
  if (args.length !== inputs.length) {
    throw new Error(
      `${contractName} constructor takes ${inputs.length} argument(s) ` +
        `(${inputs.map((i) => `${i.type} ${i.name}`).join(", ") || "none"}), got ${args.length}.`,
    );
  }
  return inputs.map((input, i) => {
    const value = args[i];
    if (/^u?int/.test(input.type)) return BigInt(value);
    if (input.type === "bool") return value === "true";
    return value;
  });
}

const defaults: Record<string, string[]> = { Counter: ["0"] };
const args = parseArgs(artifact.abi, rawArgs.length ? rawArgs : (defaults[contractName] ?? []));

const account = deployerAccount();
const wallet = walletClient();

const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args });
const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) {
  throw new Error(
    `Deployer ${account.address} holds 0 ETH on ${chain.name}. ` +
      "Fund it from a Sepolia faucet (see README).",
  );
}

let gas: bigint;
try {
  gas = await publicClient.estimateGas({ account, data });
} catch (error) {
  const detail = error instanceof BaseError ? error.shortMessage : String(error);
  throw new Error(
    `Gas estimation failed, so nothing was sent. The deployer may be underfunded ` +
      `(balance ${eth(balance)}) or the constructor may revert.\n${detail}`,
  );
}
const fees = await publicClient.estimateFeesPerGas();

// Price gas live, from the chain -- never from a remembered ETH price.
const maxCost = gas * fees.maxFeePerGas;

console.log(`Network       ${chain.name} (chain id ${chain.id})`);
console.log(`Contract      ${contractName}${args.length ? ` (${args.join(", ")})` : ""}`);
console.log(`Deployer      ${account.address}`);
console.log(`Balance       ${eth(balance)}`);
console.log(`Gas estimate  ${gas.toLocaleString("en-US")} @ up to ${fees.maxFeePerGas} wei/gas`);
console.log(`Max gas cost  ${eth(maxCost)}`);

if (balance < maxCost) {
  throw new Error(
    `Deployer has ${eth(balance)} but needs up to ${eth(maxCost)}. ` +
      "Top it up from a Sepolia faucet (see README).",
  );
}

await confirm(`Deploy ${contractName} to ${chain.name} from ${account.address}?`);

const hash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args,
  gas,
});
console.log(`\nSubmitted     ${hash}`);
console.log(`              ${explorerTx(hash)}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error(`Deployment reverted (tx ${hash}).`);
}

const deployedAt = getAddress(receipt.contractAddress);
console.log(`\nDeployed      ${deployedAt}`);
console.log(`              ${explorerAddress(deployedAt)}`);
console.log(`Block         ${receipt.blockNumber}`);
console.log(`Gas used      ${receipt.gasUsed.toLocaleString("en-US")}`);
console.log(`Paid          ${eth(receipt.gasUsed * receipt.effectiveGasPrice)}`);
