import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Generates a fresh keypair for a teammate's personal deploy account.
 *
 * Run with: npm run newkey
 *
 * The key is printed, not written to disk — paste it into your own .env and
 * nowhere else.
 */

const privateKey = generatePrivateKey();
const { address } = privateKeyToAccount(privateKey);

console.log(`DEPLOYER_PRIVATE_KEY=${privateKey}`);
console.log(`address:              ${address}`);
console.log("");
console.log("Put the key in your .env (gitignored). Fund the address from a Sepolia faucet.");
console.log("Do not share the key — not in chat, not in a ticket, not with the team.");
