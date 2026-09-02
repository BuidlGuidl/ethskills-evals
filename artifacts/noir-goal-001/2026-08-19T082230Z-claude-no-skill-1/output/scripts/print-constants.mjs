#!/usr/bin/env node
// Cross-check the three implementations of the same constants.
//
//   node scripts/print-constants.mjs
//
// The JS values below come from barretenberg via bb.js; the Noir values come
// from `nargo test -p dao_zk`; the Solidity value is the literal compiled into
// MemberRegistry. All three have to agree or proofs will not verify.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashNode, identityCommitment, initHashes, toHex32, voteNullifier } from './lib/hashes.mjs';
import { CAPACITY, emptyRoot, TREE_DEPTH } from './lib/tree.mjs';
import { repoRoot } from './lib/prover.mjs';

await initHashes();

const computedEmptyRoot = toHex32(emptyRoot());

const source = readFileSync(join(repoRoot, 'contracts', 'src', 'MemberRegistry.sol'), 'utf8');
const inSolidity = source.match(/EMPTY_ROOT\s*=\s*(0x[0-9a-fA-F]{64})/)?.[1];

console.log(`TREE_DEPTH            ${TREE_DEPTH}`);
console.log(`CAPACITY              ${CAPACITY}`);
console.log(`EMPTY_ROOT (bb.js)    ${computedEmptyRoot}`);
console.log(`EMPTY_ROOT (Solidity) ${inSolidity}`);
console.log();
console.log('test vectors, to compare against `nargo test`:');
console.log(`  hash_node(1, 2)           ${toHex32(hashNode(1n, 2n))}`);
console.log(`  identity_commitment(1)    ${toHex32(identityCommitment(1n))}`);
console.log(`  vote_nullifier(1, 2)      ${toHex32(voteNullifier(1n, 2n))}`);

if (inSolidity?.toLowerCase() !== computedEmptyRoot.toLowerCase()) {
  console.error('\nMISMATCH: MemberRegistry.EMPTY_ROOT does not match the circuit hash.');
  process.exit(1);
}
console.log('\nEMPTY_ROOT agrees between bb.js and MemberRegistry.sol');
