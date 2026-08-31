#!/usr/bin/env node
/**
 * The check that has to pass before anything else is worth debugging.
 *
 *   node scripts/check-hash-parity.mjs
 *
 * Three independent Poseidon implementations have to agree byte for byte, or
 * proofs verify locally and fail onchain (or, worse, a tree built one way is
 * accepted by a verifier built the other way):
 *
 *   circuit  poseidon::poseidon::bn254::hash_2   (circuits/vote)
 *   onchain  PoseidonT3.hash                     (lib/poseidon-solidity)
 *   client   poseidon2                           (poseidon-lite)
 *
 * The vectors below were printed by `nargo test --show-output` (tests::probe in
 * circuits/vote/src/main.nr). The Solidity side is pinned to the same three
 * vectors by contracts/test/HashParity.t.sol.
 *
 * With a chain running it also checks the whole tree, not just one hash: the
 * root the offchain mirror computes from MemberJoined logs must equal the root
 * MemberRegistry computed onchain.
 */
import { hash2, toHex32 } from "./client/poseidon.mjs";
import { treeFromJoinEvents } from "./client/tree.mjs";
import { contracts, provider, fetchJoinEvents } from "./client/env.mjs";

const VECTORS = [
  [1n, 2n, "0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a"],
  [0n, 0n, "0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864"],
  [
    0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdn,
    0x0fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543n,
    "0x2df12316ba0807e2fdf76ce4247f9bc5e793ecdf49bbf9627609263695478249",
  ],
];

let failed = false;
for (const [a, b, want] of VECTORS) {
  const got = toHex32(hash2(a, b));
  const ok = got === want;
  failed ||= !ok;
  const abbr = (x) => (x < 0x10000n ? x.toString() : "0x…" + toHex32(x).slice(-8));
  console.log(`${ok ? "ok  " : "FAIL"} H(${abbr(a)}, ${abbr(b)}) = ${got}`);
}
if (failed) {
  console.error("\nposeidon-lite disagrees with the circuit. Do not proceed.");
  process.exit(1);
}
console.log("client Poseidon matches the circuit's test vectors.");

// ---- whole-tree check, if a chain is reachable -----------------------------
try {
  const p = provider();
  const { registry } = contracts(p);
  const onchainRoot = await registry.root();
  const events = await fetchJoinEvents(registry);
  const mirrorRoot = treeFromJoinEvents(events).root;

  if (mirrorRoot === onchainRoot) {
    console.log(`tree parity ok: ${events.length} leaves, root ${toHex32(onchainRoot)}`);
  } else {
    console.error(`TREE MISMATCH\n  onchain ${toHex32(onchainRoot)}\n  mirror  ${toHex32(mirrorRoot)}`);
    process.exit(1);
  }
} catch (e) {
  console.log(`(skipped onchain tree check: ${e.message.split("\n")[0]})`);
}
