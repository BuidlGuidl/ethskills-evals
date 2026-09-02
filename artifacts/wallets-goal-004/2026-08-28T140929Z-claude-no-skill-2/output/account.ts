/**
 * Prints the deployer address and balance derived from DEPLOYER_PRIVATE_KEY.
 *
 *   npm run account
 *
 * Use it to find the address to send faucet ETH to, and to confirm .env is
 * wired up before you spend anything. It never prints the key itself.
 */
import { addressUrl, assertCorrectChain, chain, eth, getDeployerAccount, getPublicClient, getTeamAddress, reportFatal } from "./lib/config.js";

async function main() {
  const account = getDeployerAccount();
  const publicClient = getPublicClient();
  await assertCorrectChain(publicClient);

  const [balance, nonce] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.getTransactionCount({ address: account.address }),
  ]);

  console.log(`
Network   ${chain.name} (chain ${chain.id})
Deployer  ${account.address}
Balance   ${eth(balance)}
Nonce     ${nonce}
Explorer  ${addressUrl(account.address)}
Sweeps to ${getTeamAddress()}
`);

  if (balance === 0n) {
    console.log("Balance is zero — fund the deployer from a Sepolia faucet before deploying.\n");
  }
}

main().catch(reportFatal);
