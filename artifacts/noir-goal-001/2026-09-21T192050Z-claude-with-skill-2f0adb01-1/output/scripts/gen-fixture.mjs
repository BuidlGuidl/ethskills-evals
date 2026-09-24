// Writes contracts/test/fixtures/vote_proof.json: one real proof for a 3-member tree,
// used by the Forge test that checks the generated HonkVerifier accepts real proofs
// and rejects tampered public inputs. Re-run after changing the circuit.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon2 } from "poseidon-lite";
import { ROOT, commitmentOf, toHex32 } from "./lib/common.mjs";
import { proveVote } from "./lib/prove.mjs";

const note = { nullifier: 11n, secret: 22n };
note.commitment = commitmentOf(note.nullifier, note.secret);
const tree = new LeanIMT((a, b) => poseidon2([a, b]));
tree.insertMany([commitmentOf(1n, 2n), note.commitment, commitmentOf(3n, 4n)]);
const externalNullifier = 42n;
const { proof, nullifierHash } = await proveVote({ note, tree, externalNullifier, support: true });

const fixture = {
  proof,
  publicInputs: [tree.root, externalNullifier, nullifierHash, 1n].map(toHex32),
};
writeFileSync(join(ROOT, "contracts/test/fixtures/vote_proof.json"), JSON.stringify(fixture, null, 2));
console.log("wrote contracts/test/fixtures/vote_proof.json");
