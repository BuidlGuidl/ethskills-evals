import { mkdirSync, writeFileSync } from "node:fs";
import { encodeDeployData } from "viem";
import { compile } from "./compile.ts";
import { confirm, eth, makeClients, requireEnv } from "./lib.ts";

const file = requireEnv("CONTRACT_FILE");
const name = requireEnv("CONTRACT_NAME");
const args: unknown[] = JSON.parse(process.env.CONSTRUCTOR_ARGS?.trim() || "[]");

const { abi, bytecode } = compile(file, name);
const { account, publicClient, walletClient } = await makeClients();

const data = encodeDeployData({ abi, bytecode, args });
const [balance, gas, fees] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.estimateGas({ account, data }),
  publicClient.estimateFeesPerGas(),
]);
const maxCost = gas * fees.maxFeePerGas;

console.log(`Network:          Sepolia (chain ${publicClient.chain.id})`);
console.log(`Contract:         ${name} (${file})`);
console.log(`Constructor args: ${JSON.stringify(args)}`);
console.log(`Deployer:         ${account.address}`);
console.log(`Balance:          ${eth(balance)}`);
console.log(`Estimated gas:    ${gas} @ max ${eth(fees.maxFeePerGas)}/gas`);
console.log(`Max gas cost:     ${eth(maxCost)}`);

if (balance < maxCost) {
  console.error(`Deployer balance is below the max gas cost. Fund ${account.address} with Sepolia ETH first.`);
  process.exit(1);
}
await confirm("Deploy?");

const hash = await walletClient.deployContract({ abi, bytecode, args, gas: (gas * 120n) / 100n });
console.log(`Sent: ${hash} — waiting for confirmation…`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  console.error(`Deployment failed (tx ${hash}).`);
  process.exit(1);
}

const address = receipt.contractAddress;
console.log(`\n${name} deployed to ${address}`);
console.log(`  https://sepolia.etherscan.io/address/${address}`);
console.log(`  gas paid: ${eth(receipt.gasUsed * receipt.effectiveGasPrice)}`);

mkdirSync("deployments", { recursive: true });
writeFileSync(
  `deployments/sepolia-${name}.json`,
  JSON.stringify(
    { contract: name, address, txHash: hash, block: Number(receipt.blockNumber), deployer: account.address, args, abi },
    null,
    2,
  ) + "\n",
);
console.log(`  recorded in deployments/sepolia-${name}.json`);
