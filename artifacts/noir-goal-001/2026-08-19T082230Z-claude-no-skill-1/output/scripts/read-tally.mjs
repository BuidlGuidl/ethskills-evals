#!/usr/bin/env node
// Read a closed proposal's result. Needs no key and no membership: after the
// deadline the tally is public to anyone.
//
//   node scripts/read-tally.mjs --proposal 0

import { ballotAt, connect, parseArgs } from './lib/chain.mjs';

const args = parseArgs();
const proposalId = BigInt(args.proposal ?? 0);

const { provider, deployment } = await connect();
const ballot = ballotAt(deployment, provider);

const [, subject, deadline, anonymitySetSize] = await ballot.proposalInfo(proposalId);

try {
  const [yes, no, turnout] = await ballot.tally(proposalId);
  console.log(`proposal ${proposalId}  (subject ${subject})`);
  console.log(`  yes      ${yes}`);
  console.log(`  no       ${no}`);
  console.log(`  turnout  ${turnout} of ${anonymitySetSize} eligible`);
  console.log(`  outcome  ${yes > no ? 'PASSED' : yes < no ? 'REJECTED' : 'TIED'}`);
} catch (error) {
  if (error.revert?.name === 'VotingStillOpen') {
    console.log(`proposal ${proposalId} is still open until ${new Date(Number(deadline) * 1000).toISOString()}`);
    process.exit(1);
  }
  throw error;
}
