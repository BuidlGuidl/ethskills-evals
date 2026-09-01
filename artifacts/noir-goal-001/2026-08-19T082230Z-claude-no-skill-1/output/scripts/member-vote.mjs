#!/usr/bin/env node
// One member, one proposal, secret -> submitted ballot.
//
//   node scripts/member-vote.mjs --member 3 --proposal 0 --support yes --relayer 0x<key>
//
// Every step below happens on the member's own machine except the last one, and
// the last one is deliberately sent by somebody else's wallet. Run with
// --explain to print what each step does and does not leak.

import { identityCommitment, initHashes, toHex32, voteNullifier } from './lib/hashes.mjs';
import { deriveSecret } from './lib/identity.mjs';
import { ballotAt, connect, parseArgs, registryAt, walletFrom } from './lib/chain.mjs';
import { leafIndexOf, treeForRoot } from './lib/registry.mjs';
import { prove } from './lib/prover.mjs';

const args = parseArgs();
const memberSpec = args.member ?? '0';
const proposalId = BigInt(args.proposal ?? 0);
const support = parseSupport(args.support);
const selfSubmit = Boolean(args['self-submit']);

if (!selfSubmit && !args.relayer) {
  console.error(
    'refusing to run without --relayer.\n\n' +
      'A ballot sent from the wallet that holds the membership NFT is attributable\n' +
      'to that member the moment it lands: the proof hides which member voted, the\n' +
      'transaction sender does not. Pass --relayer <key|account index> to have\n' +
      'someone else submit it, or --self-submit to do it anyway.',
  );
  process.exit(1);
}

await initHashes();
const { provider, deployment } = await connect();
const member = walletFrom(memberSpec, provider);
const registry = registryAt(deployment, provider);
const ballot = ballotAt(deployment, provider);

// ---------------------------------------------------------------- 1. secret
// Local. No network, no chain, nothing observable. The same signature yields
// the same secret for every proposal, forever.
const secret = await deriveSecret(member);
const commitment = identityCommitment(secret);

console.log('1. identity');
console.log(`   member wallet  ${member.address}`);
console.log(`   commitment     ${toHex32(commitment)}   (public, in the registry since they joined)`);
console.log('   secret         (never leaves this machine)');

// ------------------------------------------------------- 2. anonymity set
// The tree is rebuilt from the registry's public log, locally. Asking a server
// for a Merkle path would tell that server which leaf is about to vote.
const [membershipRoot, subject, deadline, anonymitySetSize] = await ballot.proposalInfo(proposalId);
const tree = await treeForRoot(registry, membershipRoot);
const leafIndex = leafIndexOf(tree, commitment);
if (leafIndex === -1) {
  throw new Error('this member is not in the snapshot for this proposal - they joined too late, or never joined');
}

console.log('\n2. proposal');
console.log(`   id             ${proposalId}`);
console.log(`   subject        ${subject}`);
console.log(`   snapshot root  ${membershipRoot}`);
console.log(`   anonymity set  ${anonymitySetSize} members`);
console.log(`   deadline       ${new Date(Number(deadline) * 1000).toISOString()}`);
console.log(`   own leaf       ${leafIndex}   (private - never sent anywhere)`);

if (BigInt(anonymitySetSize) < 2n) {
  console.warn('\n   WARNING: an anonymity set of one hides nothing. Wait for more members to join.');
}

// ---------------------------------------------------------- 3. nullifier
// Deterministic in (secret, proposal), so a second ballot on this proposal
// collides and is rejected. Unlinkable to the commitment without the secret.
const externalNullifier = await ballot.externalNullifier(proposalId);
const nullifier = voteNullifier(secret, externalNullifier);

console.log('\n3. ballot');
console.log(`   direction      ${support ? 'YES' : 'NO'}`);
console.log(`   nullifier      ${toHex32(nullifier)}`);

// ------------------------------------------------------------- 4. proving
console.log('\n4. proving membership without naming the member...');
const started = Date.now();
const { proof } = await prove('vote', {
  root: membershipRoot,
  external_nullifier: externalNullifier,
  nullifier: toHex32(nullifier),
  vote: toHex32(support ? 1n : 0n),
  secret: toHex32(secret),
  leaf_index: toHex32(BigInt(leafIndex)),
  siblings: tree.siblings(leafIndex).map(toHex32),
});
console.log(`   proved in ${Date.now() - started} ms, ${(proof.length - 2) / 2} bytes`);

// ------------------------------------------------------------ 5. submission
// castBallot never reads msg.sender, so this can be anyone. It should be
// anyone: the proof is the authorisation, the sender is just postage.
const submitter = selfSubmit ? member.connect(provider) : walletFrom(args.relayer, provider);
if (selfSubmit) {
  console.warn('\n   --self-submit: this transaction links the ballot to the member. Only do this in tests.');
}
if ((await provider.getBalance(submitter.address)) === 0n) {
  throw new Error(`submitter ${submitter.address} has no ETH for gas`);
}

console.log('\n5. submitting');
console.log(`   sender         ${submitter.address}${selfSubmit ? '  (the member - deanonymising!)' : '  (relayer)'}`);

const tx = await ballotAt(deployment, submitter).castBallot(proposalId, support, toHex32(nullifier), proof);
const receipt = await tx.wait();
console.log(`   tx             ${receipt.hash}`);
console.log(`   gas            ${receipt.gasUsed}`);

console.log('\nWhat the chain now shows: a transaction from ' + submitter.address);
console.log(`spending nullifier ${toHex32(nullifier)} on proposal ${proposalId} in the`);
console.log(`${support ? 'YES' : 'NO'} direction. Which of the ${anonymitySetSize} members it came from is not`);
console.log('recoverable from anything on chain.');

function parseSupport(value) {
  const normalised = String(value ?? '').toLowerCase();
  if (['yes', 'y', 'true', '1', 'for'].includes(normalised)) return true;
  if (['no', 'n', 'false', '0', 'against'].includes(normalised)) return false;
  throw new Error('--support must be yes or no');
}
