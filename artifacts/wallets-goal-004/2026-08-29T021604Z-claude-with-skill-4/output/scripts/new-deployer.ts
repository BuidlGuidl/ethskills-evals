import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Mint a fresh, single-purpose deploy key.
 *
 * Prints to stdout only. Nothing is written to disk, so nothing can be
 * committed by accident — you copy the key into your own .env by hand.
 */
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log(`
New deploy account
──────────────────────────────────────────────────────────────
  Address      ${account.address}
  Private key  ${privateKey}
──────────────────────────────────────────────────────────────

  1. Paste the private key into .env as DEPLOYER_PRIVATE_KEY.
  2. Fund the address with only the Sepolia ETH this deploy needs.
     Faucet: https://www.alchemy.com/faucets/ethereum-sepolia
  3. Do not reuse this key on mainnet, and do not send it to anyone.
     If it ever lands in a chat, a ticket, or a PR, it is burned —
     sweep it and generate a new one.
`);
