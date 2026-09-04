import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { encodeDeployData, formatEther, getAddress, type Abi, type Hex } from "viem";
import { assertSepolia, deployerAccount, publicClient, walletClient } from "./src/clients.js";
import { isConfigError, requiredAddress } from "./src/env.js";
import { confirm, eth, gwei, sepoliaExplorer } from "./src/confirm.js";

/**
 * Deploy to Sepolia.
 *
 *   npm run compile
 *   npm run deploy
 *
 * To ship a different contract: change CONTRACT_NAME and constructorArgs().
 */

const CONTRACT_NAME = "Counter";

/** Constructor arguments. Keep authority out of the deploy key: the owner is
 *  the team Safe, read from the environment, never the account signing here. */
function constructorArgs(owner: `0x${string}`): readonly unknown[] {
  return [owner];
}

type Artifact = { contractName: string; abi: Abi; bytecode: Hex };

function loadArtifact(name: string): Artifact {
  try {
    return JSON.parse(readFileSync(`artifacts/${name}.json`, "utf8")) as Artifact;
  } catch {
    throw new Error(`artifacts/${name}.json not found. Run \`npm run compile\` first.`);
  }
}

async function main() {
  const artifact = loadArtifact(CONTRACT_NAME);
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(
      `${CONTRACT_NAME} compiled to empty bytecode — is it an interface or abstract contract?`,
    );
  }

  const owner = requiredAddress(
    "CONTRACT_OWNER",
    "Set it to the team Safe — the address that should control the contract after deploy.",
  );

  const account = deployerAccount();
  const client = publicClient();
  const wallet = walletClient();

  await assertSepolia(client);

  const args = constructorArgs(owner.address);
  const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args });

  const [balance, fees, gas, nonce] = await Promise.all([
    client.getBalance({ address: account.address }),
    client.estimateFeesPerGas(),
    client.estimateGas({ account, data }),
    client.getTransactionCount({ address: account.address }),
  ]);

  // Pad the gas limit a little: the estimate is against the current block, and
  // the tx lands in a later one.
  const gasLimit = (gas * 115n) / 100n;
  const maxCost = gasLimit * fees.maxFeePerGas;

  if (balance < maxCost) {
    throw new Error(
      `Deployer ${account.address} holds ${formatEther(balance)} ETH but the deploy ` +
        `can cost up to ${formatEther(maxCost)} ETH. Top it up:\n` +
        `  https://www.alchemy.com/faucets/ethereum-sepolia`,
    );
  }

  const facts: Array<[string, string]> = [
    ["Contract", `${artifact.contractName} (${(artifact.bytecode.length - 2) / 2} bytes)`],
    ["Network", "Sepolia (chain 11155111)"],
    ["Deployer", `${account.address}  nonce ${nonce}`],
    ["Deployer balance", eth(balance)],
    ["Contract owner", `${owner.address}${owner.checksumVerified ? "" : "  (checksum UNVERIFIED)"}`],
    ["Gas limit", `${gasLimit} (estimated ${gas})`],
    ["Max fee", gwei(fees.maxFeePerGas)],
    ["Max cost", eth(maxCost)],
  ];

  if (owner.address.toLowerCase() === account.address.toLowerCase()) {
    facts.push([
      "WARNING",
      "CONTRACT_OWNER is the deploy key itself — whoever steals that key owns the contract.",
    ]);
  }
  if (!owner.checksumVerified) {
    facts.push([
      "WARNING",
      "CONTRACT_OWNER is all-lowercase, so a wrong character cannot be detected. Verify it.",
    ]);
  }

  await confirm(`Deploy ${artifact.contractName} to Sepolia`, facts);

  console.log("\nBroadcasting…");
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: args as never,
    gas: gasLimit,
  });
  console.log(`  tx ${hash}`);
  console.log(`  ${sepoliaExplorer("tx", hash)}`);
  console.log("  waiting for receipt…");

  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });

  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deploy reverted. See ${sepoliaExplorer("tx", hash)}`);
  }

  const deployedAddress = getAddress(receipt.contractAddress);
  const spent = receipt.gasUsed * receipt.effectiveGasPrice;
  const remaining = await client.getBalance({ address: account.address });

  console.log(`
Deployed
──────────────────────────────────────────────────────────────
  ${artifact.contractName}   ${deployedAddress}
  Owner       ${owner.address}
  Block       ${receipt.blockNumber}
  Gas used    ${receipt.gasUsed} @ ${gwei(receipt.effectiveGasPrice)}
  Cost        ${eth(spent)}
  Left over   ${eth(remaining)}
  Explorer    ${sepoliaExplorer("address", deployedAddress)}
──────────────────────────────────────────────────────────────`);

  mkdirSync("deployments", { recursive: true });
  const record = {
    contractName: artifact.contractName,
    address: deployedAddress,
    owner: owner.address,
    constructorArgs: args.map(String),
    chainId: 11155111,
    network: "sepolia",
    deployer: account.address,
    transactionHash: hash,
    blockNumber: Number(receipt.blockNumber),
    deployedAt: new Date().toISOString(),
  };
  const path = `deployments/sepolia-${artifact.contractName}.json`;
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\nRecorded in ${path} — commit it so the team shares one address.`);
  console.log(`When you are done deploying, return the leftover ETH:  npm run sweep`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(isConfigError(error) ? `\nConfiguration problem\n  ${message}` : `\nDeploy failed\n  ${message}`);
  process.exit(1);
});
