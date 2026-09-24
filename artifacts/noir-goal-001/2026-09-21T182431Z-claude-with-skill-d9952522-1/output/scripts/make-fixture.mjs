// Writes contracts/test/fixtures/vote_proof.json: a real proof for a fixed
// identity in a one-member tree, so forge tests can exercise the real verifier
// and check Solidity/JS/Noir Poseidon parity. Rerun after rebuilding the circuit.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { poseidon2 } from "poseidon-lite";
import { IMT } from "@zk-kit/imt";
import { DEPTH, ROOT_DIR, proveVote } from "./lib.mjs";

const note = { identityNullifier: 1234n, identityTrapdoor: 5678n };
note.commitment = poseidon2([note.identityNullifier, note.identityTrapdoor]);
const tree = new IMT(poseidon2, DEPTH, 0n, 2);
tree.insert(note.commitment);
const proposal = { root: tree.root, scope: 42n };
const { proof, nullifierHash } = await proveVote({ note, tree, proposal, support: true });

const dir = join(ROOT_DIR, "contracts/test/fixtures");
mkdirSync(dir, { recursive: true });
const hex = (x) => "0x" + x.toString(16).padStart(64, "0");
writeFileSync(
  join(dir, "vote_proof.json"),
  JSON.stringify({ commitment: hex(note.commitment), root: hex(tree.root), scope: hex(42n), nullifierHash: hex(nullifierHash), proof }, null, 2) + "\n",
);
console.log("wrote", join(dir, "vote_proof.json"));
