import "dotenv/config";

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const TEAM_ACCOUNT = getAddress("0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC");
const GAS_PRICE_BUFFER_BPS = 1_200n;
const BPS_DENOMINATOR = 1_000n;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or export it in your shell.`);
  }
  return value;
}

function readPrivateKey(): Hex {
  const privateKey = requiredEnv("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key with a 0x prefix.");
  }
  return privateKey as Hex;
}

function hasYesFlag(): boolean {
  return process.argv.includes("--yes");
}

async function estimateSweepGas({
  publicClient,
  from,
  to,
}: {
  publicClient: ReturnType<typeof createPublicClient>;
  from: Address;
  to: Address;
}): Promise<bigint> {
  const recipientCode = await publicClient.getCode({ address: to });
  if (!recipientCode || recipientCode === "0x") {
    return 21_000n;
  }

  const estimate = await publicClient.estimateGas({
    account: from,
    to,
    value: 1n,
  });
  return (estimate * 120n) / 100n;
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
  const gas = await estimateSweepGas({
    publicClient,
    from: account.address,
    to: TEAM_ACCOUNT,
  });
  const networkGasPrice = await publicClient.getGasPrice();
  const gasPrice = (networkGasPrice * GAS_PRICE_BUFFER_BPS) / BPS_DENOMINATOR;
  const gasCost = gas * gasPrice;

  console.log(`Sweeping from: ${account.address}`);
  console.log(`Sweeping to: ${TEAM_ACCOUNT}`);
  console.log(`Current balance: ${formatEther(balance)} ETH`);
  console.log(`Gas limit: ${gas}`);
  console.log(`Gas price: ${gasPrice} wei`);
  console.log(`Reserved gas cost: ${formatEther(gasCost)} ETH`);

  if (balance <= gasCost) {
    throw new Error("Balance is not high enough to pay gas for the sweep.");
  }

  const value = balance - gasCost;
  console.log(`Sweep amount: ${formatEther(value)} ETH`);

  if (!hasYesFlag()) {
    console.log("Dry run only. Re-run with --yes to broadcast the sweep transaction.");
    return;
  }

  const hash = await walletClient.sendTransaction({
    account,
    to: TEAM_ACCOUNT,
    value,
    gas,
    gasPrice,
  });

  console.log(`Sweep transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Sweep failed in transaction ${hash}.`);
  }

  const remainingBalance = await publicClient.getBalance({ address: account.address });
  console.log(`Sweep confirmed in block: ${receipt.blockNumber}`);
  console.log(`Remaining deployer balance: ${formatEther(remainingBalance)} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
