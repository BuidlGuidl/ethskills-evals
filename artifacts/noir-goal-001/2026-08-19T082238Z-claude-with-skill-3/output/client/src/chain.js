// viem plumbing: ABIs straight out of the forge build, addresses out of the deploy
// script's deployments/<chainid>.json, and the accounts used by the demo.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount, mnemonicToAccount } from "viem/accounts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..", "..");

export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
export const CHAIN_ID = Number(process.env.CHAIN_ID ?? 31337);

export const localChain = defineChain({
  id: CHAIN_ID,
  name: "local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

/** ABI from the forge artifact, so it can never drift from the deployed bytecode. */
export function abiOf(contractName, fileName = `${contractName}.sol`) {
  const path = join(ROOT, "contracts", "out", fileName, `${contractName}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8")).abi;
  } catch {
    throw new Error(`missing artifact ${path} -- run \`npm run contracts:build\` first`);
  }
}

export function loadDeployment(chainId = CHAIN_ID) {
  const path = join(ROOT, "contracts", "deployments", `${chainId}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`missing ${path} -- run \`npm run deploy:local\` first`);
  }
}

export function publicClient() {
  return createPublicClient({ chain: localChain, transport: http(RPC_URL) });
}

export function walletFor(account) {
  return createWalletClient({ account, chain: localChain, transport: http(RPC_URL) });
}

// Anvil's default mnemonic. Index 0 is the deployer / NFT admin.
export const ANVIL_MNEMONIC =
  process.env.MNEMONIC ?? "test test test test test test test test test test test junk";

export function anvilAccount(index) {
  return mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: index });
}

export function accountFromKey(pk) {
  return privateKeyToAccount(pk);
}

/**
 * The relayer.
 *
 * It must be an address with no funding trail back to any member -- a shared service,
 * a bundler, or an ERC-4337 paymaster. In this demo it is just another anvil account,
 * which is fine locally and NOT fine on a real chain: if members top up "their"
 * relayer from their own wallets, the funding transaction re-links them to the vote
 * and the proof was pointless. See NOTES.md.
 */
export function relayerAccount() {
  return process.env.RELAYER_KEY
    ? accountFromKey(process.env.RELAYER_KEY)
    : anvilAccount(Number(process.env.RELAYER_INDEX ?? 9));
}

export async function waitFor(hash, client = publicClient()) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`tx ${hash} reverted`);
  return receipt;
}

export const toHex32 = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");
