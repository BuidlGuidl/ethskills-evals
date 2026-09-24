import "dotenv/config";

import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadDeployConfig } from "../src/config.js";
import { compileStreakContract } from "./compile.js";

const config = loadDeployConfig();
const account = privateKeyToAccount(config.privateKey);
const compiled = compileStreakContract();
const chain = defineChain({
  id: config.chainId,
  name: `chain-${config.chainId}`,
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});

const publicClient = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(config.rpcUrl),
});

const hash = await walletClient.deployContract({
  abi: compiled.abi,
  bytecode: compiled.bytecode,
});

console.log(`Deploy transaction: ${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (!receipt.contractAddress) {
  throw new Error("Deployment transaction did not create a contract");
}

console.log(`StreakCheckIn deployed at: ${receipt.contractAddress}`);
console.log(`Deployment block: ${receipt.blockNumber.toString()}`);
console.log("Set STREAK_CONTRACT_ADDRESS and STREAK_START_BLOCK to these values before starting the indexer.");
