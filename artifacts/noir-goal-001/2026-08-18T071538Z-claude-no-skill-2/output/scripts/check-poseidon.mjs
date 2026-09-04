#!/usr/bin/env node
//
// The JS side (@zkpassport/poseidon2) and the Noir side (noir-lang/poseidon)
// have to agree bit for bit, or members would build trees the circuit rejects.
// This checks that agreement without trusting either implementation's docs.
//
//   node scripts/check-poseidon.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { commitment } from "../js/core/identity.js";
import { hex32 } from "../js/core/poseidon.js";
import { proveCircuit, ROOT } from "../js/core/prover.js";
import { buildTree, EMPTY_ROOT } from "../js/core/tree.js";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail && !ok ? `\n        ${detail}` : ""}`);
  if (!ok) failures++;
};

// 1. The Solidity constant is the empty root JS computes.
const solidity = readFileSync(join(ROOT, "src", "MemberRegistry.sol"), "utf8");
const onChain = solidity.match(/EMPTY_ROOT\s*=\s*(0x[0-9a-fA-F]{64})/)?.[1];
check("MemberRegistry.EMPTY_ROOT matches the JS empty root", onChain === hex32(EMPTY_ROOT), `solidity ${onChain}\n        js       ${hex32(EMPTY_ROOT)}`);

// 2. Noir agrees. The register circuit asserts the tree relation internally, so
//    if the two Poseidon2 implementations diverged, witness generation fails.
const leaf = commitment(7n);
const before = buildTree([]);
const after = buildTree([leaf]);
try {
  proveCircuit("register", {
    old_root: hex32(before.root),
    new_root: hex32(after.root),
    leaf: hex32(leaf),
    index: "0",
    siblings: before.siblings(0).map(hex32),
  });
  check("the register circuit accepts a JS-built Merkle path", true);
} catch (err) {
  check("the register circuit accepts a JS-built Merkle path", false, String(err.message).split("\n")[0]);
}

process.exit(failures === 0 ? 0 : 1);
