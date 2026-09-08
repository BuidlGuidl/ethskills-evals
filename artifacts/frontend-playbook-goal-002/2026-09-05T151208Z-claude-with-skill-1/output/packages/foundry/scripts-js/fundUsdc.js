/**
 * Give an address real Base USDC on the local fork.
 *
 * A fork is a copy of Base state, so instead of deploying a mock token we impersonate an
 * account that already holds USDC and transfer from it. Nothing is broadcast anywhere.
 *
 * Usage:
 *   yarn fund <address> [amountInUsdc]   # defaults to 1000 USDC
 */
import {
  assertLocalFork,
  formatUsdc,
  fundUsdc,
  usdcBalance,
} from "./forkHelpers.js";

const [recipient, amount = "1000"] = process.argv.slice(2);

if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
  console.error(
    "Usage: yarn fund <address> [amountInUsdc]\nExample: yarn fund 0xYourWalletAddress 500"
  );
  process.exit(1);
}

try {
  assertLocalFork();
  const units = fundUsdc(recipient, amount);
  console.log(`✅ Sent ${formatUsdc(units)} USDC to ${recipient}`);
  console.log(`   New balance: ${formatUsdc(usdcBalance(recipient))} USDC`);
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
