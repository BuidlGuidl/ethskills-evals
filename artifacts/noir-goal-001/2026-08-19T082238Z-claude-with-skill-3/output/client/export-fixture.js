#!/usr/bin/env node
// Generates contracts/test/fixtures/vote-proof.json: a REAL UltraHonk proof over a
// deterministic 4-member tree, so the Solidity tests exercise the actual verifier
// rather than a mock.
//
//   node client/export-fixture.js      (re-run after any change to circuits/vote)
//
// No chain involved -- the tree here is built with the same client code the voter
// uses, which is also what makes it a check that the offchain mirror and the onchain
// registry produce the same root.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { identityFromSecrets, nullifierHash } from "./src/identity.js";
import { MemberTree } from "./src/tree.js";
import { proveVote, shutdownProver } from "./src/prove.js";
import { ROOT, toHex32 } from "./src/chain.js";

const MEMBERS = 4;
const VOTER = 2; // which leaf casts the fixture vote
const PROPOSAL_ID = 0;
const SUPPORT = true;

const identities = [];
for (let i = 0; i < MEMBERS; i++) {
  identities.push(await identityFromSecrets(1000n + BigInt(i), 2000n + BigInt(i)));
}

const tree = await MemberTree.create();
for (const id of identities) tree.insert(id.commitment);

const { siblings, pathIndices } = tree.proof(VOTER);
const nullifier = await nullifierHash(identities[VOTER].secret, PROPOSAL_ID);

const { proof } = await proveVote({
  root: tree.root,
  proposalId: PROPOSAL_ID,
  nullifierHash: nullifier,
  support: SUPPORT,
  secret: identities[VOTER].secret,
  trapdoor: identities[VOTER].trapdoor,
  siblings,
  pathIndices,
});

const dir = join(ROOT, "contracts", "test", "fixtures");
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, "vote-proof.json"),
  JSON.stringify(
    {
      _generatedBy: "client/export-fixture.js",
      commitments: identities.map((i) => toHex32(i.commitment)),
      voterLeafIndex: VOTER,
      proposalId: PROPOSAL_ID,
      support: SUPPORT,
      root: toHex32(tree.root),
      nullifierHash: toHex32(nullifier),
      proof,
    },
    null,
    2,
  ) + "\n",
);

console.log(`wrote contracts/test/fixtures/vote-proof.json`);
console.log(`  root       ${toHex32(tree.root)}`);
console.log(`  nullifier  ${toHex32(nullifier)}`);
console.log(`  proof      ${(proof.length - 2) / 2} bytes`);
await shutdownProver();
