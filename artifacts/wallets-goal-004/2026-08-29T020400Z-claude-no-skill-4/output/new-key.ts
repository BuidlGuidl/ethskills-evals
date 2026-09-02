import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Generates a fresh deployer keypair.
 *
 *   npm run new-key
 *
 * Paste the private key into your local .env (which is gitignored) and fund
 * the address from a Sepolia faucet. Never share the private key, never put
 * it in a commit, a ticket, a chat message, or a prompt.
 */

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log(`\nAddress (safe to share):  ${account.address}`);
console.log(`Private key (KEEP SECRET): ${privateKey}\n`);
console.log("Add to .env as:");
console.log(`DEPLOYER_PRIVATE_KEY="${privateKey}"\n`);
