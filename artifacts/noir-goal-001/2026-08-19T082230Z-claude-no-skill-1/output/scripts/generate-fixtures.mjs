#!/usr/bin/env node
// Produce real Honk proofs for the Solidity tests.
//
//   node scripts/generate-fixtures.mjs
//
// Checked in under contracts/test/fixtures/ so `forge test` needs no Noir
// toolchain. Regenerate whenever a circuit changes - a stale fixture is exactly
// the failure the RealProofs test exists to catch.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { identityCommitment, initHashes, toHex32, voteNullifier } from './lib/hashes.mjs';
import { MembershipTree } from './lib/tree.mjs';
import { prove, repoRoot } from './lib/prover.mjs';

const outDir = join(repoRoot, 'contracts', 'test', 'fixtures');
mkdirSync(outDir, { recursive: true });

await initHashes();

// Fixed secrets: fixtures must be reproducible, and none of this is a real
// member's key.
const SECRETS = [111n, 222n, 333n, 444n];
const commitments = SECRETS.map(identityCommitment);

// --- join: appending the first member to an empty tree -----------------------
{
  const tree = new MembershipTree();
  const oldRoot = tree.root;
  const siblings = tree.siblings(0);
  tree.append(commitments[0]);

  const { proof } = await prove('join', {
    old_root: toHex32(oldRoot),
    new_root: toHex32(tree.root),
    commitment: toHex32(commitments[0]),
    leaf_index: toHex32(0n),
    siblings: siblings.map(toHex32),
  });

  write('join', {
    oldRoot: toHex32(oldRoot),
    newRoot: toHex32(tree.root),
    commitment: toHex32(commitments[0]),
    leafIndex: 0,
    proof,
  });
}

// --- vote: the third of four members votes yes -------------------------------
{
  const tree = new MembershipTree(commitments);
  const voter = 2;
  // Stands in for PrivateBallot.externalNullifier(id); the circuit does not care
  // where the value came from, so the fixture does not depend on any address.
  const externalNullifier = 0x1234567890abcdefn;
  const nullifier = voteNullifier(SECRETS[voter], externalNullifier);

  const { proof } = await prove('vote', {
    root: toHex32(tree.root),
    external_nullifier: toHex32(externalNullifier),
    nullifier: toHex32(nullifier),
    vote: toHex32(1n),
    secret: toHex32(SECRETS[voter]),
    leaf_index: toHex32(BigInt(voter)),
    siblings: tree.siblings(voter).map(toHex32),
  });

  write('vote', {
    root: toHex32(tree.root),
    externalNullifier: toHex32(externalNullifier),
    nullifier: toHex32(nullifier),
    vote: 1,
    proof,
  });
}

function write(name, data) {
  const path = join(outDir, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${path}`);
}
