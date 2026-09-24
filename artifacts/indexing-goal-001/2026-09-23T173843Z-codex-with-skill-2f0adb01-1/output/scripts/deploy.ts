import fs from "node:fs";
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

const rpcUrl = process.env.RPC_URL;
const chainId = Number(process.env.CHAIN_ID ?? 8453);
const privateKey = process.env.PRIVATE_KEY as Hex | undefined;

if (!rpcUrl) {
  throw new Error("Set RPC_URL in .env before deploying");
}

if (!privateKey || privateKey === `0x${"0".repeat(64)}`) {
  throw new Error("Set PRIVATE_KEY in .env before deploying");
}

if (!fs.existsSync("artifacts/StreakCheckIn.json")) {
  await import("./compile-contract.js");
}

const artifact = JSON.parse(fs.readFileSync("artifacts/StreakCheckIn.json", "utf8"));
const chain = chainId === 84532 ? baseSepolia : base;
const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ account, chain, transport });

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  account,
});

console.log(`Deployment transaction: ${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`StreakCheckIn deployed: ${receipt.contractAddress}`);
console.log(`Start block for indexer: ${receipt.blockNumber}`);
