import "dotenv/config";

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const TEAM_ACCOUNT = "0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC";
const SEPOLIA_CHAIN_ID = 11155111;
const ETH_TRANSFER_GAS = 21_000n;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or export it before running.`);
  }
  return value;
}

function parsePrivateKey(value: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte 0x-prefixed private key.");
  }
  return value as Hex;
}

function parseRecipient(): Address {
  const recipient = process.env.SWEEP_TO?.trim() || TEAM_ACCOUNT;
  if (!isAddress(recipient)) {
    throw new Error("SWEEP_TO must be a valid Ethereum address.");
  }
  return recipient;
}

async function main() {
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const privateKey = parsePrivateKey(requireEnv("DEPLOYER_PRIVATE_KEY"));
  const recipient = parseRecipient();
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "true";

  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });
  const chainId = await publicClient.getChainId();

  if (chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(`RPC is connected to chain ${chainId}, expected Sepolia (${SEPOLIA_CHAIN_ID}).`);
  }

  const recipientCode = await publicClient.getCode({ address: recipient });
  if (recipientCode && recipientCode !== "0x") {
    throw new Error("Sweep recipient appears to be a contract. This script only sweeps to an EOA.");
  }

  const [balance, gasPrice] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.getGasPrice(),
  ]);
  const gasCost = ETH_TRANSFER_GAS * gasPrice;

  if (balance <= gasCost) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH is not enough to pay sweep gas ${formatEther(gasCost)} ETH.`,
    );
  }

  const value = balance - gasCost;

  console.log(`Sweeping from ${account.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Balance: ${formatEther(balance)} ETH`);
  console.log(`Estimated gas cost: ${formatEther(gasCost)} ETH`);
  console.log(`Sweep value: ${formatEther(value)} ETH`);

  if (dryRun) {
    console.log("Dry run only. Re-run without --dry-run to send the sweep transaction.");
    return;
  }

  const hash = await walletClient.sendTransaction({
    account,
    chain: sepolia,
    to: recipient,
    value,
    gas: ETH_TRANSFER_GAS,
    gasPrice,
  });

  console.log(`Sweep transaction: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Sweep confirmed in block ${receipt.blockNumber}`);
  console.log(`Sepolia Etherscan: https://sepolia.etherscan.io/tx/${hash}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
