#!/usr/bin/env node
//
// Generate real proofs for the Solidity test suite, so `forge test` exercises
// the actual circuits and the actual generated verifiers — not a mock.
//
//   node scripts/make-fixtures.mjs
//
// Deliberately address-independent: nothing here depends on where the Ballot
// happens to be deployed, so the fixtures stay valid as the tests change.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitment, nullifier } from "../js/core/identity.js";
import { hex32 } from "../js/core/poseidon.js";
import { proveCircuit, ROOT } from "../js/core/prover.js";
import { buildTree } from "../js/core/tree.js";

const out = (name, value) => {
  const path = join(ROOT, "test", "fixtures", `${name}.json`);
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
  console.log(`wrote ${path}`);
};

// --- registration: appending the first member to an empty registry ----------
const firstSecret = 0x1111111111111111111111111111111111111111111111111111111111n;
const firstLeaf = commitment(firstSecret);
const empty = buildTree([]);
const afterFirst = buildTree([firstLeaf]);

const register = proveCircuit("register", {
  old_root: hex32(empty.root),
  new_root: hex32(afterFirst.root),
  leaf: hex32(firstLeaf),
  index: "0",
  siblings: empty.siblings(0).map(hex32),
});
out("register", {
  comment: "register circuit: insert leaf 0 into an empty depth-8 tree",
  oldRoot: hex32(empty.root),
  newRoot: hex32(afterFirst.root),
  leaf: hex32(firstLeaf),
  index: 0,
  proof: register.proof,
});

// --- voting: member at leaf 2 of a four-member tree, voting yes -------------
const secrets = [firstSecret, 0x2222n, 0x3333n, 0x4444n];
const leaves = secrets.map(commitment);
const tree = buildTree(leaves);
const voterIndex = 2;
const context = 0x0abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678n;
const nullifierHash = nullifier(secrets[voterIndex], context);

const vote = proveCircuit("vote", {
  root: hex32(tree.root),
  proposal_context: hex32(context),
  vote: "1",
  nullifier_hash: hex32(nullifierHash),
  secret: hex32(secrets[voterIndex]),
  index: String(voterIndex),
  siblings: tree.siblings(voterIndex).map(hex32),
});
out("vote", {
  comment: "vote circuit: leaf 2 of a 4-member tree votes yes",
  root: hex32(tree.root),
  proposalContext: hex32(context),
  vote: 1,
  nullifier: hex32(nullifierHash),
  leaves: leaves.map(hex32),
  proof: vote.proof,
});
