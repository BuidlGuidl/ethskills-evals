import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatEther, type Abi, type Hex } from "viem";
import { account, assertSepolia, explorer, publicClient, walletClient } from "./config.js";

/**
 * Deploys a compiled contract to Sepolia and prints its address.
 *
 * Usage:
 *   npm run deploy                    # deploys CONTRACT (default: Greeter)
 *   CONTRACT=MyToken npm run deploy
 *
 * Constructor arguments: edit constructorArgs() below for your contract.
 */

const CONTRACT = process.env.CONTRACT ?? "Greeter";

/** Constructor args for the contract being deployed. Adjust per contract. */
function constructorArgs(name: string): unknown[] {
  switch (name) {
    case "Greeter":
      return [process.env.GREETING ?? "gm from Sepolia"];
    default:
      return [];
  }
}

type Artifact = { abi: Abi; bytecode: Hex; contractName: string };

function loadArtifact(name: string): Artifact {
  const path = join("artifacts", `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(`No artifact at ${path}. Run "npm run compile" first.`);
  }
  const artifact = JSON.parse(readFileSync(path, "utf8")) as Artifact;
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(`${name} has empty bytecode — is it an interface or abstract contract?`);
  }
  return artifact;
}

async function main(): Promise<void> {
  await assertSepolia();

  const { abi, bytecode } = loadArtifact(CONTRACT);
  const args = constructorArgs(CONTRACT);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer: ${account.address}`);
  console.log(`Balance:  ${formatEther(balance)} ETH`);
  if (balance === 0n) {
    throw new Error(
      "Deployer has no Sepolia ETH. Fund it from a faucet (see README) and retry.",
    );
  }

  console.log(`Deploying ${CONTRACT}${args.length ? ` with args ${JSON.stringify(args)}` : ""}...`);

  const hash = await walletClient.deployContract({ abi, bytecode, args });
  console.log(`Tx sent: ${hash}`);
  console.log(`  ${explorer(`tx/${hash}`)}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Deploy transaction reverted (${hash}).`);
  }
  if (!receipt.contractAddress) {
    throw new Error(`Receipt has no contract address (${hash}).`);
  }

  const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log("");
  console.log(`${CONTRACT} deployed at: ${receipt.contractAddress}`);
  console.log(`  ${explorer(`address/${receipt.contractAddress}`)}`);
  console.log(`  block ${receipt.blockNumber}, gas used ${receipt.gasUsed} (${formatEther(gasCost)} ETH)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
