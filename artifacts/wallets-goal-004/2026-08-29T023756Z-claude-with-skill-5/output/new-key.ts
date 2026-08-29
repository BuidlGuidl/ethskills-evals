/**
 * Generates a fresh deployer key.  npm run new-key
 *
 * Prints to the terminal only — it is never written to a file, so paste it
 * into your own .env yourself. Do not send the output to anyone: a key that
 * has been through a chat, a ticket, or a PR is burned and has to be replaced.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const key = generatePrivateKey();
console.log(`address:     ${privateKeyToAccount(key).address}`);
console.log(`private key: ${key}`);
console.log(
  "\nPaste the private key into .env as DEPLOYER_PRIVATE_KEY, then fund the " +
    "address from a Sepolia faucet (https://sepoliafaucet.com).",
);
