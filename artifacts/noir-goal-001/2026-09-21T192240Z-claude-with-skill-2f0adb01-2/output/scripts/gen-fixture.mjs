// Generates contracts/test/fixtures/vote.json: a real ZK proof used by the
// Foundry tests against the real HonkVerifier. Regenerate whenever the circuit
// or the test's deployment layout changes:
//   VOTING=<address printed by the failing test> node scripts/gen-fixture.mjs
import fs from "node:fs";
import path from "node:path";
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon2 } from "poseidon-lite";
import { commitmentOf, nullifierHashOf, scopeOf } from "./lib/identity.mjs";
import { merkleWitness } from "./lib/tree.mjs";
import { MAX_DEPTH, proveVote } from "./lib/prove.mjs";

const voting = process.env.VOTING ?? "0x0000000000000000000000000000000000000000";
const chainId = 31337;
const proposalId = 0n;
// Must match AnonVotingTest.setUp().
const members = [[1n, 2n], [3n, 4n], [5n, 6n]].map(([n, t]) => ({ identityNullifier: n, identityTrapdoor: t }));
const voter = members[1];
const support = true;

const tree = new LeanIMT((a, b) => poseidon2([a, b]), members.map(commitmentOf));
const scope = scopeOf(chainId, voting, proposalId);
const nullifierHash = nullifierHashOf(voter, scope);
const { proof } = await proveVote({
  identity: voter, witness: merkleWitness(tree, commitmentOf(voter), MAX_DEPTH),
  root: tree.root, scope, nullifierHash, support,
});

const hex32 = (x) => "0x" + x.toString(16).padStart(64, "0");
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../contracts/test/fixtures/vote.json");
fs.writeFileSync(out, JSON.stringify({
  voting, root: hex32(tree.root), scope: hex32(scope), nullifierHash: hex32(nullifierHash), support, proof,
  commitments: members.map((m) => hex32(commitmentOf(m))),
}, null, 2));
console.log(`wrote ${out}`);
