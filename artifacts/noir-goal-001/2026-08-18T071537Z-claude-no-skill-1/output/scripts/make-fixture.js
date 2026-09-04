#!/usr/bin/env node
// Produce a real ballot proof for contracts/test/HonkVerifier.t.sol, so
// `forge test` proves -- offline, with no chain and no node running -- that the
// generated Solidity verifier accepts what this repo's prover produces.
//
// Regenerate after every ./scripts/build-circuit.sh:  node scripts/make-fixture.js

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { commitmentOf, nullifierOf } from "./lib/member.js";
import { toField } from "./lib/hash.js";
import { MemberTree } from "./lib/tree.js";
import { proveBallot } from "./lib/prove.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "contracts/test/fixtures/ballot-proof.json");

// Deterministic stand-in for 150 enrolled members, so the fixture is reproducible.
const MEMBER_COUNT = 150;
const VOTER_INDEX = 42;
const secrets = Array.from({ length: MEMBER_COUNT }, (_, i) => toField(BigInt(i) * 1_000_003n + 7n));
const tree = new MemberTree(secrets.map(commitmentOf));

const proposalTag = toField("0x00" + "ab".repeat(31));
const secret = secrets[VOTER_INDEX];
const nullifier = nullifierOf(secret, proposalTag);
const { path, bits } = tree.pathFor(VOTER_INDEX);

console.log(`proving ballot for member ${VOTER_INDEX} of ${MEMBER_COUNT}...`);
const { proof, publicInputs } = await proveBallot({
  root: tree.root,
  proposalTag,
  secret,
  path,
  bits,
  vote: 1,
  nullifier,
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ root: tree.root, proposalTag, nullifier, vote: 1, proof, publicInputs }, null, 2) + "\n",
);
console.log(`wrote ${OUT} (${(proof.length - 2) / 2} byte proof)`);
