#!/usr/bin/env node
// One member joins the voting set. Done once, ever - not once per proposal.
//
//   node scripts/member-join.mjs --member 3 --token 3
//
// This transaction IS attributable, deliberately: it is sent by the member's
// own NFT-holding wallet and it publishes their identity commitment. Membership
// is already public, and nothing here reveals anything about future ballots.

import { identityCommitment, initHashes, toHex32 } from './lib/hashes.mjs';
import { deriveSecret } from './lib/identity.mjs';
import { connect, parseArgs, registryAt, walletFrom } from './lib/chain.mjs';
import { currentTree, leafIndexOf } from './lib/registry.mjs';
import { prove } from './lib/prover.mjs';

const args = parseArgs();
const memberSpec = args.member ?? '0';
const tokenId = BigInt(args.token ?? memberSpec);

await initHashes();
const { provider, deployment } = await connect();
const member = walletFrom(memberSpec, provider);
const registry = registryAt(deployment, member);

console.log(`member wallet   ${member.address}`);
console.log(`membership token #${tokenId}`);

// 1. Secret. Derived from a wallet signature, so it is the same secret for
//    every proposal from now on and never has to be stored anywhere.
const secret = await deriveSecret(member);
const commitment = identityCommitment(secret);
console.log(`commitment      ${toHex32(commitment)}`);

// 2. Current tree, rebuilt from the registry's own log.
const tree = await currentTree(registry);
if (leafIndexOf(tree, commitment) !== -1) {
  console.log('\nthis commitment is already in the tree - nothing to do');
  process.exit(0);
}

const leafIndex = tree.size;
const siblings = tree.siblings(leafIndex);
const oldRoot = tree.root;
tree.append(commitment);
const newRoot = tree.root;

console.log(`leaf index      ${leafIndex}`);
console.log(`old root        ${toHex32(oldRoot)}`);
console.log(`new root        ${toHex32(newRoot)}`);

// 3. Prove the append is a legal one: same tree, one empty slot filled.
console.log('\nproving the insertion...');
const started = Date.now();
const { proof } = await prove('join', {
  old_root: toHex32(oldRoot),
  new_root: toHex32(newRoot),
  commitment: toHex32(commitment),
  leaf_index: toHex32(BigInt(leafIndex)),
  siblings: siblings.map(toHex32),
});
console.log(`proved in ${Date.now() - started} ms`);

// 4. Send it. From the member's own wallet: the registry has to see the NFT.
const tx = await registry.join(tokenId, toHex32(commitment), toHex32(oldRoot), toHex32(newRoot), proof);
const receipt = await tx.wait();
console.log(`\njoined. tx ${receipt.hash}  gas ${receipt.gasUsed}`);
console.log(`registry now holds ${await registry.memberCount()} members`);
