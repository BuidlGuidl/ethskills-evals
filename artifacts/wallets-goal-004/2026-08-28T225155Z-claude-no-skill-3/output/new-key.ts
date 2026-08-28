/**
 * Generates a fresh keypair for use as a deployer.
 *
 *   npm run new-key
 *
 * Prints to stdout only — nothing is written to disk. Paste the private key
 * into your own .env (which is gitignored) and never share it.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log(`
New deployer keypair
  address      ${account.address}
  private key  ${privateKey}

Add to .env:
  DEPLOYER_PRIVATE_KEY=${privateKey}

This key is only as safe as the machine you generated it on. Use it for
testnet only — never put mainnet funds behind a key that lives in a .env file.
`);
