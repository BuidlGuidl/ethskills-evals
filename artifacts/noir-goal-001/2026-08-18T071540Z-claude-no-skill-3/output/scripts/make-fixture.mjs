// Regenerate the proof fixture used by contracts/test/PrivateBallot.t.sol.
//
//   npm run fixtures
//
// Deterministic: same scenario in, same proof scenario out. Run this after any
// change to the circuit or to the hashes, then paste the printed constants into
// PrivateBallot.t.sol if they moved.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { toBeHex } from "ethers";
import { ROOT, CONTRACTS_DIR } from "./common/deployment.mjs";
import { commitmentFromSecret, nullifierFor, buildTree, merkleProof } from "./common/crypto.mjs";
import { generateVoteProof, ensureVerificationKey } from "./common/prove.mjs";

// The scenario the Solidity test reproduces on-chain.
const SECRETS = [1n, 2n, 3n];
const VOTER = 0; // leaf index of the member who votes
const PROPOSAL_ID = 1n;
const VOTE = 1n; // yes

function main() {
  ensureVerificationKey();

  const commitments = SECRETS.map(commitmentFromSecret);
  const tree = buildTree(commitments);
  const { path } = merkleProof(tree, VOTER);
  const nullifier = nullifierFor(SECRETS[VOTER], PROPOSAL_ID);

  const { proof } = generateVoteProof({
    root: tree.root,
    proposalId: PROPOSAL_ID,
    nullifier,
    vote: VOTE,
    secret: SECRETS[VOTER],
    path,
    leafIndex: VOTER,
  });

  const out = resolve(CONTRACTS_DIR, "test", "fixtures", "vote_proof.hex");
  writeFileSync(out, proof);

  console.log(`Wrote ${out.replace(ROOT + "/", "")} (${(proof.length - 2) / 2} bytes)\n`);
  console.log("Constants for contracts/test/PrivateBallot.t.sol:");
  commitments.forEach((c, i) => {
    console.log(`  COMMITMENT_${i + 1} = ${toBeHex(c, 32)};`);
  });
  console.log(`  EXPECTED_ROOT = ${toBeHex(tree.root, 32)};`);
  console.log(`  NULLIFIER     = ${toBeHex(nullifier, 32)};`);
}

main();
