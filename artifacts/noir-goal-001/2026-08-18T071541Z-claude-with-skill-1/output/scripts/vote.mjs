/**
 * Step 3 — one member goes from their secret to a cast ballot.
 *
 *   npm run vote -- --member 7 --proposal 1 --support yes
 *   npm run vote -- --member 7 --proposal 1 --support yes --via burner
 *
 * The shape of this script is the point. Stages 1-5 are pure local computation: the member's
 * secrets, the tree, and the proof never touch the network. Only stage 6 sends a transaction, and
 * by then the payload contains nothing that identifies the member — which is why it can be handed
 * to a relayer, or to a wallet that has never held a membership NFT.
 *
 * `--via relayer` (default) — the member sends the proof over any channel to a relayer, which
 * submits it. The member's own wallet never appears onchain, and there is no funding trail to
 * follow, because the member never needed gas.
 *
 * `--via burner` — the member submits from a fresh keypair. Only private if that key was funded
 * without leaving a link to the member; see the warning the script prints.
 */
import { formatEther, parseEther } from "ethers";
import { identityFromSeed, identityFromWallet, nullifierHash } from "./lib/identity.mjs";
import { buildTree } from "./lib/tree.mjs";
import { proveVote } from "./lib/prove.mjs";
import { toHex32 } from "./lib/field.mjs";
import { connect, accountAt, freshWallet, provider } from "./lib/deployment.mjs";
import { RELAYER_ACCOUNT_INDEX, memberAccountIndex, demoSeed } from "./demo-members.mjs";

/* ---------------------------------------------------------------- arguments */

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

const memberIndex = Number(flag("--member", "7"));
const proposalId = BigInt(flag("--proposal", "1"));
const support = { yes: 1, no: 0, "1": 1, "0": 0 }[flag("--support", "yes")];
const via = flag("--via", "relayer");
const useWalletSignature = args.includes("--sign");

if (support === undefined) throw new Error("--support must be yes or no");
if (via !== "relayer" && via !== "burner") throw new Error("--via must be relayer or burner");

const p = provider();
const { voting, registry, deployment } = connect(p);

/* ------------------------------------- 1. the secret, and what it unlocks (offline) */

const memberWallet = accountAt(memberAccountIndex(memberIndex), p);
const identity = useWalletSignature ? await identityFromWallet(memberWallet) : identityFromSeed(demoSeed(memberIndex));

console.log(`1. identity for member ${memberIndex}`);
console.log(`   wallet holding the NFT  ${memberWallet.address}  (never sends a voting tx)`);
console.log(`   commitment (public)     ${toHex32(identity.commitment)}`);
console.log(`   identity secrets        kept local, never transmitted`);

/* ------------------------------------- 2. the proposal's pinned anonymity set (read-only RPC) */

const proposal = await voting.getProposal(proposalId);
const now = (await p.getBlock("latest")).timestamp;
if (BigInt(now) >= proposal.deadline) throw new Error(`proposal ${proposalId} closed`);

const [createdLog] = await voting.queryFilter(voting.filters.ProposalCreated(proposalId), 0);
if (!createdLog) throw new Error(`no ProposalCreated log for proposal ${proposalId}`);

console.log(`\n2. proposal ${proposalId}`);
console.log(`   snapshot root  ${toHex32(proposal.merkleRoot)}`);
console.log(`   snapshot block ${createdLog.blockNumber}`);
console.log(`   deadline       ${new Date(Number(proposal.deadline) * 1000).toISOString()}`);

/* ------------------------------------- 3. rebuild the tree from the event log (read-only RPC) */

// Replay only up to the proposal's block: members who registered later are not in this proposal's
// anonymity set, and including them would produce a root the contract will not accept.
const tree = await buildTree(registry, deployment.deployBlock ?? 0, createdLog.blockNumber);
console.log(`\n3. rebuilt the registry tree from MemberRegistered logs`);
console.log(`   ${tree.size} members, depth ${tree.depth}, root ${toHex32(tree.root)}`);

if (tree.root !== BigInt(proposal.merkleRoot)) {
  throw new Error(`rebuilt root ${toHex32(tree.root)} != proposal snapshot ${toHex32(proposal.merkleRoot)}`);
}
if (tree.indexOf(identity.commitment) === -1) {
  throw new Error(`member ${memberIndex} is not in this proposal's tree — register before the proposal opens`);
}

/* ------------------------------------- 4. nullifier, scoped to this proposal (offline) */

const nh = nullifierHash(identity.identityNullifier, proposalId);
console.log(`\n4. nullifier hash for this proposal`);
console.log(`   ${toHex32(nh)}`);
console.log(`   unlinkable to the commitment above, and different on every other proposal`);

if (await voting.nullifierUsed(proposalId, toHex32(nh))) {
  throw new Error(`member ${memberIndex} has already voted on proposal ${proposalId}`);
}

/* ------------------------------------- 5. prove (offline, ~1s) */

console.log(`\n5. generating proof (no network, no signature)`);
const started = Date.now();
const { proofHex, publicInputs } = await proveVote({
  identity,
  tree,
  proposalId,
  nullifierHash: nh,
  support,
});
console.log(`   ${(proofHex.length - 2) / 2} bytes in ${Date.now() - started}ms`);
console.log(`   public inputs: [root, proposalId, nullifierHash, vote]`);
publicInputs.forEach((v, i) => console.log(`     [${i}] ${v}`));

/* ------------------------------------- 6. submit */

console.log(`\n6. submitting via ${via}`);
let sender;

if (via === "relayer") {
  // In production the member hands { proposalId, proof, nullifierHash, support } to the relayer
  // over Tor / a mixnet / any channel that does not reveal their IP, and the relayer pays the gas.
  // The relayer learns the ballot value, but has no way to attribute it — the payload is the same
  // whichever member produced it.
  sender = accountAt(RELAYER_ACCOUNT_INDEX, p);
  console.log(`   relayer ${sender.address} pays gas and learns the ballot but not the voter`);
} else {
  sender = freshWallet(p);
  console.log(`   burner ${sender.address}`);
  if ((await p.getBalance(sender.address)) === 0n) {
    console.log(
      `   ! this demo is funding the burner from the anvil faucet.\n` +
        `   ! on a real chain that funding transfer is the deanonymising link: whoever funds the\n` +
        `   ! burner is trivially tied to the ballot it casts. Fund burners out of band (an\n` +
        `   ! exchange withdrawal, an existing unrelated address) or use the relayer path.`,
    );
    const faucet = accountAt(0, p);
    await (await faucet.sendTransaction({ to: sender.address, value: parseEther("0.5") })).wait();
  }
  console.log(`   balance ${formatEther(await p.getBalance(sender.address))} ETH`);
}

const tx = await connect(sender).voting.castVote(proposalId, proofHex, toHex32(nh), support);
const receipt = await tx.wait();

console.log(`\n   tx ${tx.hash}  (gas used ${receipt.gasUsed})`);
console.log(`   from ${receipt.from}`);

/* ------------------------------------- 7. what the chain now shows */

const after = await voting.getProposal(proposalId);
console.log(`\n7. what a chain observer can read`);
console.log(`   tx sender          ${receipt.from}  <- ${via === "relayer" ? "the relayer" : "a burner"}`);
console.log(`   nullifier hash     ${toHex32(nh)}  <- opaque; no link to any commitment`);
console.log(`   ballot             ${support === 1 ? "yes" : "no"}  <- the vote value is public`);
console.log(`   running tally      yes ${after.yesVotes} / no ${after.noVotes}`);
console.log(`   NOT recoverable    which of the ${tree.size} members cast it`);
