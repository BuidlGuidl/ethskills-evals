import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { compileStreakCheckIn } from "./compile";

const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const rpcUrl = process.env.BASE_RPC_URL ?? process.env.PONDER_RPC_URL_8453;
const chainName = process.env.CHAIN ?? "base";
const chain = chainName === "base-sepolia" ? baseSepolia : base;

if (privateKey === undefined) {
  throw new Error("PRIVATE_KEY is required");
}

if (rpcUrl === undefined) {
  throw new Error("BASE_RPC_URL or PONDER_RPC_URL_8453 is required");
}

const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ account, chain, transport });
const { abi, bytecode } = await compileStreakCheckIn();

console.log(`Deploying StreakCheckIn to ${chain.name} from ${account.address}`);
const hash = await walletClient.deployContract({
  account,
  abi,
  bytecode,
});

console.log(`Transaction: ${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.contractAddress === null) {
  throw new Error("Deployment transaction did not create a contract");
}

console.log(`Contract: ${receipt.contractAddress}`);
console.log(`Start block: ${receipt.blockNumber.toString()}`);
