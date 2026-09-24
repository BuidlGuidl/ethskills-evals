/**
 * Sends the deployer's leftover Sepolia ETH (minus the transfer's gas) to the
 * team account.
 *
 *   npm run sweep            # interactive confirmation
 *   npm run sweep -- --yes   # skip confirmation (CI)
 *
 * Config (env / .env): SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY (optional; prompted
 * if unset), SWEEP_TO (optional; defaults to the team account).
 */
import { formatEther, getAddress, isAddress } from "viem";
import {
  TEAM_ACCOUNT,
  assertSepolia,
  confirm,
  etherscanTx,
  fail,
  loadDeployer,
  sepoliaClients,
} from "./lib.ts";

const TRANSFER_GAS = 21_000n;

async function main() {
  const rawTo = process.env.SWEEP_TO?.trim() || TEAM_ACCOUNT;
  // Strict EIP-55 check: a mixed-case address with a bad checksum usually means a typo.
  if (!isAddress(rawTo)) {
    fail(
      `Sweep destination ${rawTo} is not a valid checksummed address.\n` +
        `Confirm the correct address from a trusted source before sending funds.`,
    );
  }
  const to = getAddress(rawTo);

  const account = await loadDeployer();
  if (to === account.address) fail("SWEEP_TO is the deployer itself.");
  const { publicClient, walletClient } = sepoliaClients(account);
  await assertSepolia(publicClient);

  // Sweeping to a contract may need more than 21k gas (or revert); only allow plain accounts.
  const code = await publicClient.getCode({ address: to });
  if (code && code !== "0x") fail(`${to} has contract code; this script only sweeps to plain accounts.`);

  const [balance, fees] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateFeesPerGas(),
  ]);
  const maxGasCost = TRANSFER_GAS * fees.maxFeePerGas;
  if (balance <= maxGasCost) {
    console.log(`Nothing to sweep: balance ${formatEther(balance)} ETH does not cover gas.`);
    return;
  }
  // Reserve the worst-case fee. Whatever isn't charged (maxFee - actual) stays behind as dust.
  const value = balance - maxGasCost;

  console.log(`
  Network:      Sepolia (chain ${publicClient.chain.id})
  From:         ${account.address}
  To:           ${to}${to === getAddress(TEAM_ACCOUNT) ? " (team account)" : ""}
  Balance:      ${formatEther(balance)} ETH
  Sending:      ${formatEther(value)} ETH
  Max gas cost: ${formatEther(maxGasCost)} ETH
`);
  if (!(await confirm(`Send ${formatEther(value)} ETH to ${to}?`))) fail("Aborted.");

  const hash = await walletClient.sendTransaction({
    to,
    value,
    gas: TRANSFER_GAS,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`Sent: ${etherscanTx(hash)}\nWaiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") fail(`Sweep transaction ${hash} failed.`);

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`
Swept ${formatEther(value)} ETH to ${to} in block ${receipt.blockNumber}.
  Deployer remaining: ${formatEther(remaining)} ETH
`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
