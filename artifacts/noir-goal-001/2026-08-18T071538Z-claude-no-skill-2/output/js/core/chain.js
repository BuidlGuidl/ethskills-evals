// Local-chain plumbing: deployment lookup, ABIs straight out of `forge build`,
// and the wallets used by each step of the flow.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import { ROOT } from "./prover.js";

export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

/** anvil's default mnemonic; the 150 member wallets are derived from it. */
export const MNEMONIC = process.env.MNEMONIC ?? "test test test test test test test test test test test junk";

/**
 * A completely unrelated seed for the relayer wallets. In production the DAO
 * never sees these keys at all — the relayer is a third party, or at minimum a
 * wallet the member funded from somewhere with no path back to them. Deriving
 * relayers from the member mnemonic would look fine on chain and be exactly the
 * mistake this whole design exists to avoid.
 */
export const RELAYER_MNEMONIC =
  process.env.RELAYER_MNEMONIC ?? "hybrid letter surge payment faculty episode object device street pool issue security";

const walletFrom = (phrase, index, provider) =>
  ethers.HDNodeWallet.fromPhrase(phrase, "", `m/44'/60'/0'/0/${index}`).connect(provider);

export const memberWallet = (index, provider) => walletFrom(MNEMONIC, index, provider);
export const relayerWallet = (index, provider) => walletFrom(RELAYER_MNEMONIC, index, provider);

export function abi(contractName, file = contractName) {
  const path = join(ROOT, "out", `${file}.sol`, `${contractName}.json`);
  if (!existsSync(path)) throw new Error(`missing ${path} — run \`forge build\``);
  return JSON.parse(readFileSync(path, "utf8")).abi;
}

/**
 * The UltraHonk verifier reverts with its own error selectors rather than
 * returning false, so folding its error ABI in gives readable failures when a
 * proof does not check out.
 */
const withVerifierErrors = (contractAbi) => [...contractAbi, ...abi("Errors", "HonkVerifierBase")];

export async function connect() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const { chainId } = await provider.getNetwork();

  const path = join(ROOT, "deployments", `${chainId}.json`);
  if (!existsSync(path)) {
    throw new Error(`no deployment for chain ${chainId} — run scripts/deploy-local.sh`);
  }
  const addresses = JSON.parse(readFileSync(path, "utf8"));

  return {
    provider,
    chainId,
    addresses,
    registry: new ethers.Contract(addresses.memberRegistry, withVerifierErrors(abi("MemberRegistry")), provider),
    ballot: new ethers.Contract(addresses.ballot, withVerifierErrors(abi("Ballot")), provider),
    nft: new ethers.Contract(addresses.membershipNFT, abi("MembershipNFT"), provider),
  };
}

// --- member secret storage -------------------------------------------------
// In the real thing this is the member's own keystore / password manager. It is
// the only thing that must never be shared: whoever holds it can vote as them,
// and can prove after the fact how they voted.

const secretsDir = join(ROOT, ".secrets");

export function secretPath(chainId, label) {
  return join(secretsDir, `${chainId}-${label}.json`);
}

export function loadSecret(chainId, label) {
  const path = secretPath(chainId, label);
  return existsSync(path) ? BigInt(JSON.parse(readFileSync(path, "utf8")).secret) : null;
}

export function saveSecret(chainId, label, secret) {
  mkdirSync(secretsDir, { recursive: true });
  writeFileSync(secretPath(chainId, label), JSON.stringify({ secret: "0x" + secret.toString(16) }, null, 2) + "\n", {
    mode: 0o600,
  });
}

/**
 * ethers surfaces reverts from `eth_estimateGas` at the provider level, where
 * the contract's ABI is not in scope, so custom errors come back undecoded.
 * Match the selector against the contract's own interface by hand.
 */
export function decodeRevert(contract, err) {
  const data = err?.data ?? err?.info?.error?.data ?? err?.error?.data;
  try {
    const parsed = contract.interface.parseError(data);
    return parsed ? `${parsed.name}(${parsed.args.join(", ")})` : (err.shortMessage ?? err.message);
  } catch {
    return err.shortMessage ?? err.message;
  }
}

/** Give a wallet gas on a local anvil without any on-chain transfer linking it to anyone. */
export async function fundLocally(provider, address, eth = "10") {
  await provider.send("anvil_setBalance", [address, "0x" + ethers.parseEther(eth).toString(16)]);
}
