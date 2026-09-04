#!/usr/bin/env node
/**
 * STEP 3 — one member goes from their secret to a submitted ballot.
 *
 *   node scripts/vote.mjs <memberIndex> <yes|no> [proposalId]
 *
 * This is the whole privacy story in one file:
 *
 *   1. load the note (secret, nullifierSecret) saved at join time
 *   2. rebuild the Merkle tree offline from MemberJoined logs, truncated to the
 *      proposal's snapshot, and read our own path out of it
 *   3. derive the per-proposal nullifier
 *   4. prove, in process, that some leaf under the snapshot root is casting
 *      this vote — without saying which
 *   5. hand the proof to a RELAYER, which broadcasts it
 *
 * Step 5 is not decoration. `castVote` ignores `msg.sender`, but the chain does
 * not: if the member's own wallet paid for the ballot, the vote is attributed in
 * one hop and every constraint in the circuit was wasted. The relayer here is a
 * separate anvil account funded independently of any member. In production this
 * is a relayer service or an ERC-4337 bundler with a paymaster — see NOTES.md
 * for what the relayer itself can still see.
 */
import { contracts, walletAt, fetchJoinEvents, provider, RELAYER_INDEX } from "./client/env.mjs";
import { loadNote, nullifierHashFor } from "./client/identity.mjs";
import { treeFromJoinEvents } from "./client/tree.mjs";
import { toHex32 } from "./client/poseidon.mjs";
import { proveVote, voteWitnessInputs } from "./client/prover.mjs";

const memberIndex = Number(process.argv[2] ?? 1);
const choice = (process.argv[3] ?? "yes").toLowerCase();
if (!["yes", "no"].includes(choice)) throw new Error(`vote must be "yes" or "no", got "${choice}"`);
const vote = choice === "yes" ? 1n : 0n;

const p = provider();
const { registry, ballot } = contracts(p);
const proposalId = BigInt(process.argv[4] ?? (await ballot.proposalCount()));
if (proposalId === 0n) throw new Error("no proposals yet — run scripts/propose.mjs");

// ---------------------------------------------------------------- 1. the note
const note = loadNote(`member-${memberIndex}`);
console.log(`voting as     : member-${memberIndex} (commitment ${toHex32(note.commitment)})`);
console.log(`proposal      : #${proposalId}  choice: ${choice}`);

// ------------------------------------------------- 2. rebuild the tree offline
const [, snapshotRoot, eligibleMembers, deadline] = await ballot.proposalInfo(proposalId);
if (BigInt(Math.floor(Date.now() / 1000)) >= deadline) {
  throw new Error(`proposal #${proposalId} closed at ${new Date(Number(deadline) * 1000).toISOString()}`);
}

const events = await fetchJoinEvents(registry);
const tree = treeFromJoinEvents(events, Number(eligibleMembers));

if (tree.root !== snapshotRoot) {
  throw new Error(
    `rebuilt root ${toHex32(tree.root)} != snapshot root ${toHex32(snapshotRoot)} — the mirror is out of sync`,
  );
}

const leafIndex = tree.indexOf(note.commitment);
if (leafIndex < 0) {
  throw new Error(
    `commitment not in proposal #${proposalId}'s snapshot ` +
      `(${eligibleMembers} members) — this member joined after the proposal opened`,
  );
}
const merkleProof = tree.proof(leafIndex);
console.log(`snapshot root : ${toHex32(snapshotRoot)}  (rebuilt from ${eligibleMembers} MemberJoined logs)`);
console.log(`anonymity set : 1 of ${eligibleMembers}`);

// ------------------------------------------------------------- 3. nullifier
const nullifierHash = nullifierHashFor(note.nullifierSecret, proposalId);
console.log(`nullifier     : ${toHex32(nullifierHash)}  (= Poseidon(nullifierSecret, ${proposalId}))`);

if (await ballot.nullifierSpent(proposalId, nullifierHash)) {
  throw new Error(`this member already voted on proposal #${proposalId}`);
}

// ------------------------------------------------------------------ 4. prove
console.log("proving...");
const t0 = Date.now();
const { proofHex, publicInputs } = await proveVote(
  voteWitnessInputs({ root: snapshotRoot, proposalId, nullifierHash, vote, note, merkleProof }),
);
console.log(`proof         : ${(proofHex.length - 2) / 2} bytes in ${Date.now() - t0} ms`);

// The circuit's `pub` params, in order. If this ever disagrees with the array
// AnonymousBallot builds, verification fails onchain for no visible reason.
const expected = [snapshotRoot, proposalId, nullifierHash, vote].map(toHex32);
const got = publicInputs.map(toHex32);
if (JSON.stringify(expected) !== JSON.stringify(got)) {
  throw new Error(`public input mismatch\n  expected ${expected}\n  got      ${got}`);
}

// ------------------------------------------------------ 5. the relayer sends it
const relayer = walletAt(RELAYER_INDEX, p);
const memberWallet = walletAt(memberIndex, p);
console.log(`relayer       : ${relayer.address}`);
console.log(`  (NOT the member's wallet ${memberWallet.address} — that one is on the public roster)`);

const relayed = ballot.connect(relayer);
const tx = await relayed.castVote(proposalId, nullifierHash, vote, proofHex);
const receipt = await tx.wait();

console.log(`tx            : ${receipt.hash}`);
console.log(`gas used      : ${receipt.gasUsed}`);
console.log(`from          : ${receipt.from}  <-- what a chain observer sees as the sender`);
console.log("");
console.log("ballot accepted. The chain now knows one more member voted, and which way,");
console.log(`but not which of the ${eligibleMembers} it was.`);
