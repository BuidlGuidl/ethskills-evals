/**
 * One member, one secret, one anonymous ballot — the whole path.
 *
 *   npm run vote                        # member 0 votes yes on proposal 0
 *   PROPOSAL_ID=1 SUPPORT=no npm run vote
 *
 * Env:
 *   RPC_URL        default http://127.0.0.1:8545
 *   MEMBER_INDEX   anvil account index of the member (default 0)
 *   MEMBER_KEY     private key of the member, overrides MEMBER_INDEX
 *   MEMBER_SECRET  passphrase identity instead of a wallet-signature identity
 *   PROPOSAL_ID    default 0
 *   SUPPORT        yes | no (default yes)
 *   RELAYER_INDEX  anvil account index that submits the ballot (default 9)
 *   RELAYER_KEY    private key of the relayer, overrides RELAYER_INDEX
 *
 * Two wallets appear, and that separation IS the privacy property:
 *
 *   member wallet   sends join() once, ever. Publicly linked to the member.
 *   relayer wallet  sends castVote(). Must have no traceable link to the
 *                   member — see the warning printed at the end.
 */
import { JsonRpcProvider, Wallet, HDNodeWallet, Mnemonic } from "ethers";
import { deriveIdentityFromSigner, identityFromSeed, toBytes32 } from "./lib/identity.mjs";
import { findMemberTokenId, loadDeployment, nftAt, registryAt, votingAt } from "./lib/contracts.mjs";
import { buildTreeAtRoot, fetchMemberJoinedLogs } from "./lib/tree.mjs";
import { proveVote } from "./lib/prover.mjs";

const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const PROPOSAL_ID = BigInt(process.env.PROPOSAL_ID ?? 0);
const SUPPORT = (process.env.SUPPORT ?? "yes").toLowerCase() === "yes";

function anvilWallet(index, provider) {
  return HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(ANVIL_MNEMONIC),
    `m/44'/60'/0'/0/${index}`
  ).connect(provider);
}

function step(n, title) {
  console.log(`\n[${n}] ${title}`);
}

const provider = new JsonRpcProvider(RPC_URL);
const { chainId } = await provider.getNetwork();
const deployment = await loadDeployment(chainId.toString());

const member = process.env.MEMBER_KEY
  ? new Wallet(process.env.MEMBER_KEY, provider)
  : anvilWallet(Number(process.env.MEMBER_INDEX ?? 0), provider);
const relayer = process.env.RELAYER_KEY
  ? new Wallet(process.env.RELAYER_KEY, provider)
  : anvilWallet(Number(process.env.RELAYER_INDEX ?? 9), provider);

if (member.address === relayer.address) {
  throw new Error("member and relayer are the same wallet — that publishes exactly what we are hiding");
}

const registry = registryAt(deployment.membershipRegistry, member);
const voting = votingAt(deployment.anonymousVoting, provider);
const nft = nftAt(deployment.membershipNft, provider);

console.log(`chain ${chainId}  registry ${deployment.membershipRegistry}  voting ${deployment.anonymousVoting}`);
console.log(`member  ${member.address}`);
console.log(`relayer ${relayer.address}`);

// ---------------------------------------------------------------------------
step(1, "derive the voting identity — offchain, nothing is sent");
// ---------------------------------------------------------------------------
// The wallet signature is deterministic, so this identity is reproducible from
// the member's key alone: there is no note file to back up or lose.
const identity = process.env.MEMBER_SECRET
  ? identityFromSeed(process.env.MEMBER_SECRET)
  : await deriveIdentityFromSigner(member);
console.log(`    commitment ${toBytes32(identity.commitment)}`);
console.log("    identityNullifier / identitySecret stay on this machine, forever");

// ---------------------------------------------------------------------------
step(2, "join the anonymity set — tx from the MEMBER wallet");
// ---------------------------------------------------------------------------
const tokenId = await findMemberTokenId(nft, member.address, deployment.startBlock ?? 0);
if (tokenId === undefined) {
  throw new Error(`${member.address} holds no membership NFT`);
}
if (await registry.hasJoined(tokenId)) {
  console.log(`    membership token #${tokenId} already registered; skipping`);
} else {
  const tx = await registry.join(tokenId, identity.commitment);
  const receipt = await tx.wait();
  console.log(`    join(${tokenId}, commitment) tx ${receipt.hash}`);
  console.log("    observer learns: the holder of token #" + tokenId + " registered a commitment.");
  console.log("    Not which way it will ever vote.");
}
console.log(`    anonymity set is now ${await registry.memberCount()} members`);

// ---------------------------------------------------------------------------
step(3, "read the proposal and rebuild its snapshot of the member tree");
// ---------------------------------------------------------------------------
if ((await voting.proposalCount()) <= PROPOSAL_ID) {
  throw new Error(`proposal ${PROPOSAL_ID} does not exist — create one first (see client/demo.mjs)`);
}
const proposal = await voting.getProposal(PROPOSAL_ID);
const deadline = Number(proposal.deadline);
console.log(`    "${proposal.description}"`);
console.log(`    snapshot: ${proposal.snapshotMemberCount} members, root ${toBytes32(proposal.snapshotRoot)}`);
if (Math.floor(Date.now() / 1000) >= deadline) {
  console.warn("    warning: voting has closed on this proposal; the tx below will revert");
}

const joins = await fetchMemberJoinedLogs(registry, deployment.startBlock ?? 0);
const { tree, leafIndexOf } = buildTreeAtRoot(joins, proposal.snapshotRoot);
const leafIndex = leafIndexOf.get(identity.commitment);
if (leafIndex === undefined) {
  throw new Error("this member joined after the proposal was created and cannot vote on it");
}
console.log(`    rebuilt tree: depth ${tree.depth}, our leaf is #${leafIndex} of ${tree.size}`);

// ---------------------------------------------------------------------------
step(4, "generate the proof — offchain, ~10-30s, nothing is sent");
// ---------------------------------------------------------------------------
const scope = await voting.scopeOf(PROPOSAL_ID);
const ballot = await proveVote({
  identity,
  tree,
  leafIndex,
  scope,
  support: SUPPORT,
});
console.log(`    vote          ${SUPPORT ? "YES" : "NO"}`);
console.log(`    nullifierHash ${ballot.nullifierHash}`);
console.log(`    proof         ${(ballot.proofHex.length - 2) / 2} bytes`);

if (await voting.nullifierSpent(scope, ballot.nullifierHash)) {
  throw new Error("this identity has already voted on this proposal");
}

// ---------------------------------------------------------------------------
step(5, "submit the ballot — tx from the RELAYER wallet, never the member's");
// ---------------------------------------------------------------------------
const votingAsRelayer = votingAt(deployment.anonymousVoting, relayer);
const voteTx = await votingAsRelayer.castVote(
  PROPOSAL_ID,
  ballot.nullifierHash,
  SUPPORT,
  ballot.proofHex
);
const voteReceipt = await voteTx.wait();
console.log(`    castVote() tx ${voteReceipt.hash}  gas ${voteReceipt.gasUsed}`);
console.log(
  `    observer learns: one of ${proposal.snapshotMemberCount} snapshotted members voted ` +
    `${SUPPORT ? "YES" : "NO"}. Nothing narrows it down further.`
);

console.log(`
Reminder: onchain unlinkability is only half of it. The relayer that just sent
that transaction must have no offchain link to ${member.address} —
not funded by it, not the same IP, not the only wallet awake at 3am. Use a
shared relayer or an ERC-4337 paymaster the DAO does not control.`);
