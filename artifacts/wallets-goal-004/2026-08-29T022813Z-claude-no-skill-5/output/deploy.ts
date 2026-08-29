import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { contractName, deployerPrivateKey, rpcUrl } from "./scripts/env.js";

/**
 * Deploys the compiled contract to Sepolia and prints its address.
 *
 * Usage:
 *   npm run compile
 *   npm run deploy
 *
 * Configuration comes from .env (see .env.example). The deployer key is read
 * from the environment and never written to disk or logged.
 */

/**
 * Constructor arguments, in declaration order.
 *
 * The placeholder Counter takes one uint256 (initialCount). When you swap in
 * the real contract, update this to match its constructor — an empty array if
 * it takes none. Use BigInt literals (e.g. 1n) for uint/int arguments.
 */
const CONSTRUCTOR_ARGS: readonly unknown[] = [0n];

type Artifact = { contractName: string; abi: Abi; bytecode: Hex };

function loadArtifact(name: string): Artifact {
  const path = resolve(process.cwd(), "artifacts", `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `No artifact for "${name}" at ${path}. Run \`npm run compile\` first, ` +
        `and check CONTRACT_NAME in .env matches the contract name in contracts/.`,
    );
  }
  const artifact = JSON.parse(readFileSync(path, "utf8")) as Artifact;
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(`"${name}" has no bytecode — is it an interface or abstract contract?`);
  }
  return artifact;
}

async function main(): Promise<void> {
  const name = contractName();
  const artifact = loadArtifact(name);
  const account = privateKeyToAccount(deployerPrivateKey());
  const transport = http(rpcUrl());

  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  // Fail fast if the RPC endpoint points somewhere other than Sepolia.
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(
      `SEPOLIA_RPC_URL is connected to chain ${chainId}, expected ${sepolia.id} (Sepolia).`,
    );
  }

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`contract : ${name}`);
  console.log(`deployer : ${account.address}`);
  console.log(`balance  : ${formatEther(balance)} ETH`);
  console.log(`args     : ${JSON.stringify(CONSTRUCTOR_ARGS, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v)}`);

  if (balance === 0n) {
    throw new Error(
      `Deployer has no Sepolia ETH. Fund ${account.address} from a faucet ` +
        `(https://sepoliafaucet.com or https://www.alchemy.com/faucets/ethereum-sepolia).`,
    );
  }

  console.log("\nsending deployment transaction...");
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: CONSTRUCTOR_ARGS as never,
  });
  console.log(`tx hash  : ${hash}`);
  console.log(`explorer : https://sepolia.etherscan.io/tx/${hash}`);

  console.log("waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Deployment reverted. See https://sepolia.etherscan.io/tx/${hash}`);
  }
  if (!receipt.contractAddress) {
    throw new Error(`Transaction succeeded but returned no contract address (tx ${hash}).`);
  }

  console.log(`\n✅ ${name} deployed`);
  console.log(`address  : ${receipt.contractAddress}`);
  console.log(`block    : ${receipt.blockNumber}`);
  console.log(`gas used : ${receipt.gasUsed}`);
  console.log(`explorer : https://sepolia.etherscan.io/address/${receipt.contractAddress}`);
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
