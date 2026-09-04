import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Generates a fresh burner keypair for use as a deployer.
 *
 * Run with: npm run newkey
 *
 * The key is printed to stdout and stored nowhere. Paste it into .env (which is
 * gitignored) and nowhere else. Clear your scrollback afterwards.
 */

const privateKey = generatePrivateKey();
const { address } = privateKeyToAccount(privateKey);

console.log(`address     : ${address}`);
console.log(`private key : ${privateKey}`);
console.log(`
Put the private key in .env as DEPLOYER_PRIVATE_KEY, then fund ${address}
from a Sepolia faucet. Do not commit it, paste it into chat, or reuse it on
mainnet.`);
