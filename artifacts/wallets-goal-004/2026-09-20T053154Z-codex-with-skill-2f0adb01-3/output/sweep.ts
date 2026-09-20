import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const TEAM_ACCOUNT = getAddress("0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC");

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. See README.md for setup.`);
  }
  return value;
}

function readPrivateKey(): Hex {
  const privateKey = requiredEnv("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key prefixed with 0x.");
  }
  return privateKey as Hex;
}

async function main() {
  const rpcUrl = requiredEnv("SEPOLIA_RPC_URL");
  const account = privateKeyToAccount(readPrivateKey());

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  const gasPrice = await publicClient.getGasPrice();
  let gas = await publicClient.estimateGas({
    account: account.address,
    to: TEAM_ACCOUNT,
    value: balance > 0n ? 1n : 0n,
  });
  let fee = gas * gasPrice;

  if (balance <= fee) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH is not enough to cover estimated gas ${formatEther(fee)} ETH.`,
    );
  }

  const value = balance - fee;
  gas = await publicClient.estimateGas({
    account: account.address,
    to: TEAM_ACCOUNT,
    value,
  });
  fee = gas * gasPrice;

  if (balance <= fee) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH is not enough to cover estimated gas ${formatEther(fee)} ETH.`,
    );
  }

  const sweepValue = balance - fee;

  console.log(`Sweeping Sepolia ETH from ${getAddress(account.address)}`);
  console.log(`Recipient: ${TEAM_ACCOUNT}`);
  console.log(`Current balance: ${formatEther(balance)} ETH`);
  console.log(`Estimated gas: ${gas.toString()} at ${formatEther(gasPrice)} ETH/gas`);
  console.log(`Amount to send: ${formatEther(sweepValue)} ETH`);

  if (process.env.CONFIRM_SWEEP !== "yes") {
    console.log("Dry run only. Re-run with CONFIRM_SWEEP=yes to broadcast the sweep transaction.");
    return;
  }

  const hash = await walletClient.sendTransaction({
    account,
    to: TEAM_ACCOUNT,
    value: sweepValue,
    gas,
    gasPrice,
  });

  console.log(`Sweep transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Sweep confirmed in block: ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
