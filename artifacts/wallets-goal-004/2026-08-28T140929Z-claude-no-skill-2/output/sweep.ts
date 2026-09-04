/**
 * Returns the deployer's leftover Sepolia ETH to the team account.
 *
 *   npm run sweep            # dry run: prints exactly what it would send
 *   npm run sweep -- --yes   # actually broadcasts
 *
 * Reads DEPLOYER_PRIVATE_KEY and TEAM_ADDRESS from .env. Run it after the
 * deploy has confirmed — it moves the whole balance minus the gas for the
 * transfer itself, so the deployer ends up at (near) zero.
 */
import { parseArgs } from "node:util";
import { formatGwei } from "viem";

import {
  assertCorrectChain,
  chain,
  eth,
  getDeployerAccount,
  getPublicClient,
  getTeamAddress,
  getWalletClient,
  reportFatal,
  txUrl,
} from "./lib/config.js";

/** A plain ETH transfer to an EOA is always exactly 21,000 gas. */
const TRANSFER_GAS = 21_000n;

const { values } = parseArgs({
  options: {
    yes: { type: "boolean", default: false },
    /** Leave this much behind, in ETH, e.g. --keep 0.05 to fund another deploy. */
    keep: { type: "string", default: "0" },
  },
  allowPositionals: false,
});

function keepWei(): bigint {
  const keep = Number(values.keep);
  if (!Number.isFinite(keep) || keep < 0) {
    throw new Error(`--keep must be a non-negative number of ETH. Got: ${values.keep}`);
  }
  return BigInt(Math.round(keep * 1e18));
}

async function main() {
  const account = getDeployerAccount();
  const to = getTeamAddress();

  if (to.toLowerCase() === account.address.toLowerCase()) {
    throw new Error("TEAM_ADDRESS is the deployer's own address — nothing to sweep.");
  }

  const publicClient = getPublicClient();
  await assertCorrectChain(publicClient);

  const [balance, fees, destinationCode] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateFeesPerGas(),
    publicClient.getCode({ address: to }),
  ]);

  // 21,000 gas only covers a transfer to an EOA. A contract's receive()/fallback()
  // needs more, and the send would revert — refuse rather than burn the fee.
  if (destinationCode && destinationCode !== "0x") {
    throw new Error(
      `TEAM_ADDRESS ${to} is a contract, not a regular account. This script only sweeps to an EOA. ` +
        "Use a wallet that can set a higher gas limit, or point TEAM_ADDRESS at an EOA.",
    );
  }

  const maxFeePerGas = fees.maxFeePerGas;
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
  if (!maxFeePerGas) throw new Error("RPC did not return an EIP-1559 fee estimate.");

  // Worst case the transaction can cost: what the node will actually charge is
  // (baseFee + tip) * gasUsed, which is usually lower, so a little dust is left.
  const maxFee = TRANSFER_GAS * maxFeePerGas;
  const reserve = keepWei();
  const value = balance - maxFee - reserve;

  console.log(`
Network   ${chain.name} (chain ${chain.id})
From      ${account.address}
To        ${to}
Balance   ${eth(balance)}
Gas fee   up to ${eth(maxFee)} (21,000 × ${Number(formatGwei(maxFeePerGas)).toFixed(3)} gwei)${
    reserve > 0n ? `\nKeeping   ${eth(reserve)}` : ""
  }
Sending   ${eth(value)}`);

  if (value <= 0n) {
    throw new Error(
      `Nothing to sweep: the balance (${eth(balance)}) does not cover the transfer fee` +
        `${reserve > 0n ? " plus the amount you asked to keep" : ""}.`,
    );
  }

  if (!values.yes) {
    console.log("\nDry run — nothing sent. Re-run with `--yes` to broadcast.\n");
    return;
  }

  const walletClient = getWalletClient(account);
  const hash = await walletClient.sendTransaction({
    to,
    value,
    gas: TRANSFER_GAS,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  console.log(`\nSent ${hash}\n  ${txUrl(hash)}\nWaiting for confirmation…`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") {
    throw new Error(`Sweep transaction reverted. See ${txUrl(hash)}`);
  }

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`
✔ Swept ${eth(value)} to ${to}

  Fee paid  ${eth(receipt.gasUsed * receipt.effectiveGasPrice)}
  Left over ${eth(remaining)} (dust from the fee estimate being conservative)
`);
}

main().catch(reportFatal);
