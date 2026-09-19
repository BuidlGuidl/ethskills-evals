/**
 * Compiles contracts/ and deploys one contract to Sepolia.
 *
 *   npm run deploy -- --contract Counter --args '[42]'
 *
 * --args is a JSON array of constructor arguments. Large integers can be
 * passed as strings ("1000000000000000000") and are converted to bigint.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { encodeDeployData, getAddress, type Abi } from "viem";

type AbiConstructor = Extract<Abi[number], { type: "constructor" }>;
import { compileAll } from "./compile.ts";
import { chain, confirm, eth, explorerAddress, explorerTx, getClients } from "./lib.ts";

const { values } = parseArgs({
  options: {
    contract: { type: "string" },
    args: { type: "string", default: "[]" },
    yes: { type: "boolean", short: "y", default: false },
  },
});

const contractName = values.contract ?? process.env.CONTRACT_NAME;
if (!contractName) throw new Error("Pass --contract <Name> (or set CONTRACT_NAME in .env).");

const artifact = compileAll().get(contractName);
if (!artifact) throw new Error(`Contract "${contractName}" not found in contracts/.`);

// Coerce integer constructor params to bigint so large values survive JSON.
const rawArgs = JSON.parse(values.args!) as unknown[];
const ctor = artifact.abi.find((x): x is AbiConstructor => x.type === "constructor");
const inputs = ctor?.inputs ?? [];
if (rawArgs.length !== inputs.length) {
  throw new Error(
    `${contractName} constructor takes ${inputs.length} arg(s) ` +
      `(${inputs.map((i) => `${i.type} ${i.name}`).join(", ")}), got ${rawArgs.length}.`,
  );
}
const args = rawArgs.map((a, i) =>
  /^u?int\d*$/.test(inputs[i].type) && (typeof a === "string" || typeof a === "number") ? BigInt(a) : a,
);

const { account, publicClient, walletClient } = await getClients();

const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args });
const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) throw new Error(`Deployer ${account.address} has no Sepolia ETH. Fund it first (see README).`);
const [gas, fees] = await Promise.all([
  publicClient.estimateGas({ account, data }),
  publicClient.estimateFeesPerGas(),
]);
const maxCost = gas * fees.maxFeePerGas;

console.log(`Network:   ${chain.name} (${chain.id})`);
console.log(`Deployer:  ${account.address}`);
console.log(`Balance:   ${eth(balance)}`);
console.log(`Contract:  ${contractName} (solc ${artifact.compiler})`);
console.log(`Args:      ${JSON.stringify(rawArgs)}`);
console.log(`Est. gas:  ${gas} (max cost ~${eth(maxCost)})`);
if (balance < maxCost) throw new Error("Deployer balance is too low for this deployment.");

await confirm(`Deploy ${contractName} to ${chain.name}?`, values.yes!);

const hash = await walletClient.sendTransaction({ data, gas: (gas * 120n) / 100n });
console.log(`\nSent:      ${explorerTx(hash)}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error(`Deployment reverted in block ${receipt.blockNumber}.`);
}
const address = getAddress(receipt.contractAddress);

// Keep a record in deployments/ so the team can see what's live (commit this file).
const recordPath = `deployments/${chain.id}.json`;
mkdirSync("deployments", { recursive: true });
const records = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, "utf8")) : {};
records[contractName] = {
  address,
  txHash: hash,
  blockNumber: Number(receipt.blockNumber),
  deployer: account.address,
  constructorArgs: rawArgs,
  compiler: artifact.compiler,
  deployedAt: new Date().toISOString(),
};
writeFileSync(recordPath, JSON.stringify(records, null, 2) + "\n");

console.log(`\n${contractName} deployed at ${address}`);
console.log(`Explorer:  ${explorerAddress(address)}`);
console.log(`Gas used:  ${receipt.gasUsed} (${eth(receipt.gasUsed * receipt.effectiveGasPrice)})`);
console.log(`Recorded:  ${recordPath}`);
