/**
 * Generates a fresh deploy key.
 *
 *   npm run newkey
 *
 * Paste the private key into your local .env (gitignored) and nowhere else --
 * not into a chat, a ticket, a PR, or a prompt. Fund the printed address from a
 * Sepolia faucet.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const { address } = privateKeyToAccount(privateKey);

console.log(`DEPLOYER_PRIVATE_KEY=${privateKey}`);
console.log(`# address: ${address}`);
console.log("\nPut that line in .env (gitignored). Fund the address from a Sepolia faucet.");
console.log("This key is for testnet deploys only -- it is not treasury custody.");
