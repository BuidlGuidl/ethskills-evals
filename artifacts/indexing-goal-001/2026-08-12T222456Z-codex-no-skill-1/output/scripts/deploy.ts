import fs from "node:fs";
import "dotenv/config";
import solc from "solc";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

const source = fs.readFileSync("contracts/Streak.sol", "utf8");
const input = { language: "Solidity", sources: { "Streak.sol": { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors?.some((item: { severity: string }) => item.severity === "error")) throw new Error(JSON.stringify(output.errors));
const artifact = output.contracts["Streak.sol"].Streak;
const chain = process.env.CHAIN === "base" ? base : baseSepolia;
const rpcUrl = process.env.BASE_RPC_URL;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!rpcUrl || !privateKey) throw new Error("Set BASE_RPC_URL and DEPLOYER_PRIVATE_KEY");
const account = privateKeyToAccount(privateKey);
const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` });
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(JSON.stringify({ address: receipt.contractAddress, startBlock: receipt.blockNumber.toString(), transactionHash: hash }, null, 2));
