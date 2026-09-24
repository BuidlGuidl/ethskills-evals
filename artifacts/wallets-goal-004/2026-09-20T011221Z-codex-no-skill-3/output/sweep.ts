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

const DEFAULT_TEAM_ACCOUNT = "0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC";
const TRANSFER_GAS = 21_000n;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or export it before running this script.`);
  }
  return value;
}

function getPrivateKey(): Hex {
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key prefixed with 0x.");
  }
  return privateKey as Hex;
}

function getTeamAccount(): Address {
  const teamAccount = process.env.TEAM_ACCOUNT?.trim() || DEFAULT_TEAM_ACCOUNT;
  if (!isAddress(teamAccount)) {
    throw new Error(`TEAM_ACCOUNT is not a valid Ethereum address: ${teamAccount}`);
  }
  return teamAccount;
}

async function main() {
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const account = privateKeyToAccount(getPrivateKey());
  const teamAccount = getTeamAccount();

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(`RPC endpoint is connected to chain ${chainId}, expected Sepolia (${sepolia.id}).`);
  }

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) {
    console.log(`Deployer ${account.address} has no Sepolia ETH to sweep.`);
    return;
  }

  const networkGasPrice = await publicClient.getGasPrice();
  const gasPrice = (networkGasPrice * 12n) / 10n;
  const gasCost = TRANSFER_GAS * gasPrice;

  if (balance <= gasCost) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH is not enough to cover transfer gas (${formatEther(gasCost)} ETH).`,
    );
  }

  const value = balance - gasCost;
  console.log(`Sweeping ${formatEther(value)} Sepolia ETH from ${account.address} to ${teamAccount}...`);

  const hash = await walletClient.sendTransaction({
    to: teamAccount,
    value,
    gas: TRANSFER_GAS,
    gasPrice,
  });

  console.log(`Sweep transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Sweep confirmed in block ${receipt.blockNumber}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
