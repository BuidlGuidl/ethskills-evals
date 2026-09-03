/**
 * Shows the deployer address and its Sepolia balance.
 *
 *   npm run account
 *
 * Handy for checking whether a faucet request has landed yet.
 */
import { assertSepolia, eth, explorerAddress, getAccount, publicClient, rpcUrl } from "./config.js";

await assertSepolia();

const account = getAccount();
const balance = await publicClient.getBalance({ address: account.address });

console.log(`
Deployer account
  address   ${account.address}
  balance   ${eth(balance)}
  explorer  ${explorerAddress(account.address)}
  rpc       ${rpcUrl}
`);
