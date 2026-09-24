/**
 * Generate a fresh Sepolia deployer key and write it to .env (gitignored).
 * The key is never printed; only the address you need to fund is.
 *
 *   npm run new-deployer
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envFile = ".env";
const existing = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";

if (/^DEPLOYER_PRIVATE_KEY=\S/m.test(existing)) {
  console.error("✖ .env already has a DEPLOYER_PRIVATE_KEY. Remove it yourself if you really mean to replace it.");
  process.exit(1);
}

const key = generatePrivateKey();
const { address } = privateKeyToAccount(key);

const lines = existing.split("\n").filter((line) => !line.startsWith("DEPLOYER_PRIVATE_KEY="));
if (!lines.some((line) => line.startsWith("SEPOLIA_RPC_URL="))) lines.unshift("SEPOLIA_RPC_URL=");
lines.unshift(`DEPLOYER_PRIVATE_KEY=${key}`);
writeFileSync(envFile, lines.join("\n").trimEnd() + "\n");
chmodSync(envFile, 0o600);

console.log(`✔ New deployer written to ${envFile}
  Address: ${address}

Fund this address with only the Sepolia ETH the deploy needs, then run \`npm run deploy\`.`);
