import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Prints a brand-new key pair to your terminal only. Paste the key into your local .env; never commit or share it.
const key = generatePrivateKey();
console.log(`Address:     ${privateKeyToAccount(key).address}`);
console.log(`Private key: ${key}`);
