/**
 * Deploy a Foundry-compiled contract to Sepolia with viem.
 *
 *   npm run deploy -- <ContractName> [constructorArgsJson]
 *   npm run deploy -- Counter '[42]'
 *
 * Pass large integers (uint256 amounts etc.) as strings: '["1000000000000000000000000"]'.
 *
 * Reads the artifact from out/<Name>.sol/<Name>.json (run `forge build` first —
 * `npm run deploy` does it for you), asks for confirmation, deploys, and writes
 * the result to deployments/sepolia.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { encodeDeployData, formatEther, getAddress, type Abi, type Hex } from "viem";
import { assertSepolia, clients, confirm, fail, loadDeployer } from "./utils/common.ts";

const [contractName, rawArgs] = process.argv.slice(2);
if (!contractName) fail("Usage: npm run deploy -- <ContractName> [constructorArgsJson]");

const artifactPath = `out/${contractName}.sol/${contractName}.json`;
if (!existsSync(artifactPath)) fail(`No artifact at ${artifactPath}. Run \`forge build\`.`);
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const abi = artifact.abi as Abi;
const bytecode = artifact.bytecode.object as Hex;

let args: unknown[] = [];
if (rawArgs) {
  try {
    args = JSON.parse(rawArgs);
  } catch {
    fail(`Constructor args must be a JSON array, e.g. '[42, "0xabc..."]'. Got: ${rawArgs}`);
  }
  if (!Array.isArray(args)) fail("Constructor args must be a JSON array.");
}

const account = await loadDeployer();
const { publicClient, walletClient } = clients(account);
await assertSepolia(publicClient);

const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) fail(`Deployer ${account.address} has no Sepolia ETH. Fund it first (README step 4).`);
const estimated = await publicClient.estimateGas({
  account,
  data: encodeDeployData({ abi, bytecode, args }),
});
const gas = (estimated * 120n) / 100n; // 20% headroom
const fees = await publicClient.estimateFeesPerGas();
const maxCost = gas * fees.maxFeePerGas;
if (maxCost > balance) {
  fail(
    `Deployer ${account.address} has ${formatEther(balance)} ETH, needs up to ` +
      `${formatEther(maxCost)} ETH. Fund it with Sepolia ETH first.`,
  );
}

await confirm(
  [
    `Network:      Sepolia (${publicClient.chain.id})`,
    `Contract:     ${contractName}`,
    `Constructor:  ${JSON.stringify(args)}`,
    `Deployer:     ${account.address}`,
    `Balance:      ${formatEther(balance)} ETH`,
    `Gas limit:    ${gas} (max cost ${formatEther(maxCost)} ETH)`,
  ].join("\n"),
);

const hash = await walletClient!.deployContract({
  abi,
  bytecode,
  args,
  gas,
  maxFeePerGas: fees.maxFeePerGas,
  maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
});
console.log(`\nTx sent: https://sepolia.etherscan.io/tx/${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  fail(`Deployment reverted in block ${receipt.blockNumber}.`);
}
const address = getAddress(receipt.contractAddress);

const record = {
  contract: contractName,
  address,
  txHash: hash,
  blockNumber: Number(receipt.blockNumber),
  deployer: account.address,
  constructorArgs: args,
  deployedAt: new Date().toISOString(),
};
const outPath = "deployments/sepolia.json";
const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
existing[contractName] = record;
writeFileSync(outPath, JSON.stringify(existing, null, 2) + "\n");

console.log(`\n✔ ${contractName} deployed at ${address}`);
console.log(`  https://sepolia.etherscan.io/address/${address}`);
console.log(`  Recorded in ${outPath}`);
