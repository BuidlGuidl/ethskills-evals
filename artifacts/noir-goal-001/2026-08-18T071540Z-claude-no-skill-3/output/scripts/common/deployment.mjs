// Loading deployed addresses + ABIs, and the wallets used by the demo.

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Contract, Wallet, HDNodeWallet, Mnemonic } from "ethers";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONTRACTS_DIR = resolve(ROOT, "contracts");
export const CIRCUIT_DIR = resolve(ROOT, "circuits", "vote");

export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

/** The mnemonic the member wallets are derived from. Matches Deploy.s.sol. */
export const MNEMONIC = process.env.MNEMONIC ?? "test test test test test test test test test test test junk";

/** Anvil account 0: the DAO admin / deployer. */
export const ADMIN_KEY =
  process.env.DEPLOYER_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * A relayer key deliberately unrelated to any member wallet.
 *
 * In production this is whoever is willing to broadcast votes -- a public
 * relayer, a Tor-fronted service, or a key the member funded out of band. What
 * matters is only that it is not the member's NFT-holding wallet.
 */
export const RELAYER_KEY =
  process.env.RELAYER_KEY ?? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

export function provider() {
  return new JsonRpcProvider(RPC_URL);
}

export function loadDeployment(chainId = 31337) {
  const path = resolve(CONTRACTS_DIR, "deployments", `${chainId}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `No deployment at ${path}.\nRun: npm run deploy   (with anvil running on ${RPC_URL})`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Read an ABI straight out of the forge build output, so it can never drift. */
export function loadAbi(contractName) {
  const path = resolve(CONTRACTS_DIR, "out", `${contractName}.sol`, `${contractName}.json`);
  if (!existsSync(path)) {
    throw new Error(`No artifact for ${contractName} at ${path}.\nRun: npm run build`);
  }
  return JSON.parse(readFileSync(path, "utf8")).abi;
}

export function contractAt(name, address, runner) {
  return new Contract(address, loadAbi(name), runner);
}

/**
 * Members are derived past anvil's pre-funded accounts so that no member wallet
 * is ever also the admin or the relayer. Must match Deploy.s.sol.
 */
export const MEMBER_INDEX_OFFSET = 1000;

/** Member i's wallet: the one holding membership NFT tokenId i. */
export function memberWallet(index, runner) {
  const path = `m/44'/60'/0'/0/${MEMBER_INDEX_OFFSET + index}`;
  const wallet = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(MNEMONIC), path);
  return runner ? wallet.connect(runner) : wallet;
}

export function adminWallet(runner) {
  return new Wallet(ADMIN_KEY, runner);
}

export function relayerWallet(runner) {
  return new Wallet(RELAYER_KEY, runner);
}
