/**
 * Regenerate contracts/test/fixtures/vote.json — real Honk proofs the Foundry integration test
 * feeds to the real HonkVerifier. Run after any change to the circuit:
 *
 *   (cd circuits/anon_vote && nargo compile) && npm run fixture
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon2 } from "poseidon-lite";
import { nullifierHash } from "./lib/identity.mjs";
import { proveVote } from "./lib/prove.mjs";
import { toHex32 } from "./lib/field.mjs";
import { MEMBER_COUNT, demoIdentity } from "./demo-members.mjs";

const PROPOSAL_ID = 1n;
const OUT = fileURLToPath(new URL("../contracts/test/fixtures/vote.json", import.meta.url));

const identities = Array.from({ length: MEMBER_COUNT }, (_, i) => demoIdentity(i));
const tree = new LeanIMT((a, b) => poseidon2([a, b]));
tree.insertMany(identities.map((id) => id.commitment));

async function ballot(memberIndex, support) {
  const identity = identities[memberIndex];
  const nh = nullifierHash(identity.identityNullifier, PROPOSAL_ID);
  const { proofHex } = await proveVote({
    identity,
    tree,
    proposalId: PROPOSAL_ID,
    nullifierHash: nh,
    support,
  });
  return { memberIndex, support, nullifierHash: toHex32(nh), proof: proofHex };
}

const fixture = {
  proposalId: Number(PROPOSAL_ID),
  merkleRoot: toHex32(tree.root),
  treeDepth: tree.depth,
  commitments: identities.map((id) => toHex32(id.commitment)),
  // Member 7 votes yes; the same member's "no" proof exists so the test can prove that a second
  // ballot is rejected on the nullifier, not on the ballot value.
  yesVote: await ballot(7, 1),
  yesVoteRecast: await ballot(7, 0),
  // Member 149 is the ragged last leaf: its Merkle proof is 4 siblings deep, not 8.
  noVoteLastLeaf: await ballot(MEMBER_COUNT - 1, 0),
};

mkdirSync(fileURLToPath(new URL("../contracts/test/fixtures", import.meta.url)), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`wrote ${OUT}: root=${fixture.merkleRoot} depth=${fixture.treeDepth}`);
