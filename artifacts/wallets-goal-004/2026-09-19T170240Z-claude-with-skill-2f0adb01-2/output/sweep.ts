/**
 * Send the deployer's leftover Sepolia ETH to the team account.
 *
 *   npm run sweep            # shows the plan and asks for confirmation
 *   npm run sweep -- --yes   # no prompt (e.g. in CI)
 *
 * The destination is TEAM_ADDRESS from .env. It must be the EIP-55
 * checksummed form; a bad checksum usually means a typo, so we refuse it.
 */
import { formatEther, getAddress, isAddress } from "viem";
import { assertSepolia, confirm, getClients, requireEnv, txUrl } from "./lib/env.ts";

const TRANSFER_GAS = 21_000n; // plain ETH transfer to an EOA

async function main() {
  const rawTo = requireEnv("TEAM_ADDRESS");
  if (!isAddress(rawTo)) {
    throw new Error(
      `TEAM_ADDRESS ${rawTo} is not a valid checksummed address. ` +
        "Copy it again from a trusted source (e.g. the wallet UI) rather than retyping it.",
    );
  }
  const to = getAddress(rawTo); // checksummed

  const { account, publicClient, walletClient } = getClients();
  await assertSepolia(publicClient);

  if (to === account.address) throw new Error("Destination is the deployer itself; nothing to do.");

  // If the destination is a contract (e.g. a Safe), 21k gas may not be enough.
  const code = await publicClient.getCode({ address: to });
  const gas =
    code && code !== "0x"
      ? await publicClient.estimateGas({ account, to, value: 1n })
      : TRANSFER_GAS;

  const balance = await publicClient.getBalance({ address: account.address });
  const fees = await publicClient.estimateFeesPerGas();
  // Reserve the worst-case fee (gas * maxFeePerGas). The tx is charged the
  // actual base fee, so a little dust stays behind; that's expected.
  const maxFee = fees.maxFeePerGas;
  const reserved = gas * maxFee;
  const value = balance - reserved;

  console.log(`
  Network:      Sepolia (${publicClient.chain.id})
  From:         ${account.address}
  To:           ${to}
  Balance:      ${formatEther(balance)} ETH
  Gas reserve:  ${formatEther(reserved)} ETH (${gas} gas @ ${formatEther(maxFee, "gwei")} gwei max)
  Sending:      ${value > 0n ? formatEther(value) : "0"} ETH
`);

  if (value <= 0n) {
    console.log("Balance doesn't cover the transfer gas; nothing to sweep.");
    return;
  }
  if (!(await confirm(`Send ${formatEther(value)} ETH to ${to}?`))) {
    console.log("Aborted, nothing sent.");
    return;
  }

  const hash = await walletClient.sendTransaction({
    to,
    value,
    gas,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`Sent: ${txUrl(hash)}\nWaiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Sweep reverted: ${txUrl(hash)}`);

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`
✅ Swept ${formatEther(value)} ETH to ${to}
  Block:            ${receipt.blockNumber}
  Deployer balance: ${formatEther(remaining)} ETH (unused gas reserve)
`);
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
