/**
 * Generates a fresh deployer keypair locally.
 *
 *   npm run new-account
 *
 * Nothing is written to disk or sent anywhere — paste the key into your own
 * .env (gitignored) and fund the address from a Sepolia faucet.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const { address } = privateKeyToAccount(privateKey);

console.log(`\nAddress      ${address}`);
console.log(`Private key  ${privateKey}`);
console.log(`
Put it in .env as:

  DEPLOYER_PRIVATE_KEY=${privateKey}

This is a testnet key. Do not reuse it on mainnet, do not commit it, and do
not paste it into chat, tickets or CI logs.
`);
