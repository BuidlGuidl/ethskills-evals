import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

type Artifact = {
  abi: unknown[];
  bytecode: Hex;
};

const networkName = process.argv[2] ?? "baseSepolia";
const network =
  networkName === "base"
    ? {
        chain: base,
        rpcUrl: process.env.BASE_RPC_URL,
      }
    : networkName === "baseSepolia"
      ? {
          chain: baseSepolia,
          rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
        }
      : null;

if (!network) {
  throw new Error("usage: tsx scripts/deploy.ts base|baseSepolia");
}
if (!network.rpcUrl) {
  throw new Error(`missing RPC URL for ${networkName}`);
}
if (!process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("missing DEPLOYER_PRIVATE_KEY");
}

const artifactPath = join(
  process.cwd(),
  "artifacts/contracts/StreakCheckIn.sol/StreakCheckIn.json",
);
const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as Artifact;
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);

const walletClient = createWalletClient({
  account,
  chain: network.chain,
  transport: http(network.rpcUrl),
});
const publicClient = createPublicClient({
  chain: network.chain,
  transport: http(network.rpcUrl),
});

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
});
console.log(`deployment transaction: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`StreakCheckIn deployed to: ${receipt.contractAddress}`);
console.log(`start block for indexer: ${receipt.blockNumber}`);
