#!/usr/bin/env node
/**
 * Fund an address with USDC on the local Base fork.
 *
 * Real USDC can't be minted normally, but on a fork we can impersonate USDC's
 * masterMinter, authorize a minter, and mint. This gives any address spendable
 * USDC so you can try the tip flow end to end.
 *
 * Usage:
 *   yarn fund-usdc <address> [amount]
 *   # amount is in whole USDC (default 1000)
 *   yarn fund-usdc 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 500
 */
import { execSync } from "child_process";

const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const recipient = process.argv[2];
const wholeAmount = process.argv[3] ? Number(process.argv[3]) : 1000;

if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
  console.error("Usage: yarn fund-usdc <address> [amountInWholeUsdc]");
  process.exit(1);
}

const amount = BigInt(Math.round(wholeAmount * 1e6)); // USDC has 6 decimals
const oneEth = "0xde0b6b3a7640000"; // 1 ETH for gas

const sh = cmd => execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

try {
  // Sanity check the fork is reachable
  sh(`cast chain-id --rpc-url ${RPC}`);
} catch {
  console.error(`Could not reach a chain at ${RPC}. Is \`yarn fork\` running?`);
  process.exit(1);
}

try {
  const masterMinter = sh(`cast call ${USDC} "masterMinter()(address)" --rpc-url ${RPC}`);

  // Impersonate masterMinter and authorize the recipient as a minter.
  sh(`cast rpc anvil_impersonateAccount ${masterMinter} --rpc-url ${RPC}`);
  sh(`cast rpc anvil_setBalance ${masterMinter} ${oneEth} --rpc-url ${RPC}`);
  sh(
    `cast send ${USDC} "configureMinter(address,uint256)" ${recipient} ${amount} --from ${masterMinter} --unlocked --rpc-url ${RPC}`,
  );

  // Impersonate the recipient and mint USDC to itself.
  sh(`cast rpc anvil_setBalance ${recipient} ${oneEth} --rpc-url ${RPC}`);
  sh(`cast rpc anvil_impersonateAccount ${recipient} --rpc-url ${RPC}`);
  sh(`cast send ${USDC} "mint(address,uint256)" ${recipient} ${amount} --from ${recipient} --unlocked --rpc-url ${RPC}`);

  // Stop impersonating so the accounts behave normally again.
  sh(`cast rpc anvil_stopImpersonatingAccount ${masterMinter} --rpc-url ${RPC}`);
  sh(`cast rpc anvil_stopImpersonatingAccount ${recipient} --rpc-url ${RPC}`);

  const bal = sh(`cast call ${USDC} "balanceOf(address)(uint256)" ${recipient} --rpc-url ${RPC}`).split(" ")[0];
  console.log(`Minted ${wholeAmount} USDC to ${recipient}`);
  console.log(`New USDC balance: ${Number(bal) / 1e6} USDC`);
} catch (err) {
  console.error("Failed to fund USDC:", err.stderr?.toString() || err.message);
  process.exit(1);
}
