import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, HDNodeWallet, Contract } from "ethers";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
/// Anvil's default mnemonic, matching contracts/script/Deploy.s.sol.
export const MNEMONIC =
  process.env.MNEMONIC ?? "test test test test test test test test test test test junk";

export function loadDeployment() {
  const p = join(ROOT, "deployments", "local.json");
  if (!existsSync(p)) {
    throw new Error(
      `no deployment at ${p}\n` +
        `run: forge script contracts/script/Deploy.s.sol:Deploy --rpc-url ${RPC_URL} --broadcast`,
    );
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

/// ABIs come out of forge's build output, so they cannot drift from the
/// deployed bytecode.
export function abiOf(contractName) {
  const p = join(ROOT, "out", `${contractName}.sol`, `${contractName}.json`);
  if (!existsSync(p)) throw new Error(`no artifact at ${p} — run "forge build" first`);
  return JSON.parse(readFileSync(p, "utf8")).abi;
}

export function provider() {
  return new JsonRpcProvider(RPC_URL);
}

/// Wallet for account #index of the mnemonic.
///   index 0     = the deployer / DAO admin
///   index 1..N  = member wallets, each holding a membership NFT
///   RELAYER_INDEX (default 19) = the relayer, holds no NFT and is not a member
export function walletAt(index, p = provider()) {
  // Same derivation forge's `vm.deriveKey(mnemonic, i)` uses, so the wallets
  // here are exactly the ones Deploy.s.sol issued membership NFTs to.
  return HDNodeWallet.fromPhrase(MNEMONIC, "", `m/44'/60'/0'/0/${index}`).connect(p);
}

export const RELAYER_INDEX = Number(process.env.RELAYER_INDEX ?? 19);

export function contracts(signerOrProvider) {
  const d = loadDeployment();
  return {
    deployment: d,
    membership: new Contract(d.membershipNFT, abiOf("MembershipNFT"), signerOrProvider),
    registry: new Contract(d.memberRegistry, abiOf("MemberRegistry"), signerOrProvider),
    ballot: new Contract(d.anonymousBallot, abiOf("AnonymousBallot"), signerOrProvider),
  };
}

/// Every MemberJoined log, from the deployment block to head.
export async function fetchJoinEvents(registry, fromBlock = 0) {
  const logs = await registry.queryFilter(registry.filters.MemberJoined(), fromBlock, "latest");
  return logs.map((l) => ({
    leafIndex: l.args.leafIndex,
    commitment: l.args.commitment,
    newRoot: l.args.newRoot,
    blockNumber: l.blockNumber,
  }));
}
