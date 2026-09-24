/**
 * Compiles contracts/<Name>.sol and deploys it with viem.
 *
 *   npm run deploy -- <Name> [constructor args as a JSON array]
 *   npm run deploy -- MyToken '["My Token", "MTK", 1000000]'
 *
 * Shows the deployer, network, and gas cost, and waits for you to type "yes"
 * before signing. Saves the result to deployments/<network>/<Name>.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodeDeployData, formatGwei, getAddress, type Abi, type AbiParameter } from "viem";
import {
  BURNED_ACCOUNTS,
  confirmOrExit,
  connect,
  eth,
  explorerLink,
  fail,
  loadDeployer,
} from "./scripts/common.js";
import { compile } from "./scripts/compile.js";

const [name, rawArgs = "[]"] = process.argv.slice(2);
if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
  fail("Usage: npm run deploy -- <ContractName> ['[constructor, args, as, json]']");
}

const account = loadDeployer();
if (BURNED_ACCOUNTS.includes(account.address)) {
  fail(
    `${account.address} is a burned account: its private key has leaked. ` +
      `Create a new deployer key (see README) and use that instead.`,
  );
}

const { abi, bytecode } = compile(name);
const args = parseConstructorArgs(abi, rawArgs);
const { chain, publicClient, walletClient } = await connect(account);

const data = encodeDeployData({ abi, bytecode, args });
const [balance, estimatedGas, fees] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.estimateGas({ account, data }),
  publicClient.estimateFeesPerGas(),
]);
const gas = (estimatedGas * 120n) / 100n; // 20% headroom; unused gas is not charged
const maxCost = gas * fees.maxFeePerGas;

console.log(`
Deploy ${name}
  network         ${chain.name} (chain id ${chain.id})
  deployer        ${account.address}
  balance         ${eth(balance)}
  constructor     ${JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v))}
  estimated gas   ${estimatedGas} (limit ${gas})
  max fee         ${formatGwei(fees.maxFeePerGas)} gwei (priority ${formatGwei(fees.maxPriorityFeePerGas)} gwei)
  expected cost   ~${eth(estimatedGas * fees.maxFeePerGas)} (at most ${eth(maxCost)})`);

if (balance < maxCost) {
  fail(`The deployer's balance (${eth(balance)}) might not cover the max cost (${eth(maxCost)}). Add more ${chain.name} ETH.`);
}

await confirmOrExit(`Deploy ${name} to ${chain.name}?`);

const hash = await walletClient.sendTransaction({
  data,
  gas,
  maxFeePerGas: fees.maxFeePerGas,
  maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
});
console.log(`\nSent: ${explorerLink(chain, "tx", hash)}\nWaiting for confirmation...`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  fail(`Deployment transaction ${hash} reverted.`);
}

const address = getAddress(receipt.contractAddress);
const gasPaid = receipt.gasUsed * receipt.effectiveGasPrice;
const outDir = path.join("deployments", chain.id === 31337 ? "anvil" : chain.name.toLowerCase());
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${name}.json`);
writeFileSync(
  outFile,
  JSON.stringify(
    {
      contract: name,
      address,
      chainId: chain.id,
      deployer: account.address,
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      abi,
    },
    null,
    2,
  ) + "\n",
);

console.log(`
Deployed ${name}
  address   ${address}
  explorer  ${explorerLink(chain, "address", address)}
  gas paid  ${eth(gasPaid)}
  saved to  ${outFile}

Once you're done deploying, run "npm run sweep" to send the leftover ETH back to the team account.`);

/** Parses a JSON array of constructor args and converts integer types to bigint. */
function parseConstructorArgs(abi: Abi, raw: string): readonly unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(`Constructor args must be a JSON array, got: ${raw}`);
  }
  if (!Array.isArray(parsed)) fail(`Constructor args must be a JSON array, got: ${raw}`);

  const inputs: readonly AbiParameter[] = abi.find((item) => item.type === "constructor")?.inputs ?? [];
  if (parsed.length !== inputs.length) {
    const expected = inputs.map((i) => `${i.type} ${i.name ?? ""}`.trim()).join(", ");
    fail(`${name}'s constructor takes ${inputs.length} args (${expected}), but ${parsed.length} were given.`);
  }
  return parsed.map((value, i) => coerce(inputs[i]!.type, value));
}

function coerce(type: string, value: unknown): unknown {
  if (type.endsWith("]") && Array.isArray(value)) {
    const inner = type.slice(0, type.lastIndexOf("["));
    return value.map((v) => coerce(inner, v));
  }
  if (/^u?int\d*$/.test(type) && (typeof value === "number" || typeof value === "string")) {
    return BigInt(value);
  }
  return value;
}
