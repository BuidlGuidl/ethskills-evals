/**
 * Show which account the tooling will deploy from, and what it holds.
 * Prints the address only — never the private key.
 *
 *   npm run account
 */
import { formatEther } from "viem";
import { assertSepolia, loadConfig, reportFatal } from "../src/config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  await assertSepolia(config);

  const balance = await config.publicClient.getBalance({
    address: config.account.address,
  });

  console.log(`Deployer: ${config.account.address}`);
  console.log(`Balance : ${formatEther(balance)} ETH (Sepolia)`);
  console.log(`Team    : ${config.teamAddress}`);
  console.log(`Explorer: https://sepolia.etherscan.io/address/${config.account.address}`);

  if (balance === 0n) {
    console.log("\nEmpty. Fund it from a faucet: https://sepoliafaucet.com");
  }
}

main().catch(reportFatal);
