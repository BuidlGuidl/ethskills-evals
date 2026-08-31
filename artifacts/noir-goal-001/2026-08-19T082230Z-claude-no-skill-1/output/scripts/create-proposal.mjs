#!/usr/bin/env node
// Open a proposal. Sent by a member's own wallet; nothing here is private.
//
//   node scripts/create-proposal.mjs --proposer 0 --text "Fund the grants round" --hours 24

import { id as keccakOfString } from 'ethers';
import { ballotAt, connect, parseArgs, walletFrom } from './lib/chain.mjs';

const args = parseArgs();
const text = args.text ?? 'Untitled proposal';
const hours = Number(args.hours ?? 24);

const { provider, deployment } = await connect();
const proposer = walletFrom(args.proposer ?? '0', provider);
const ballot = ballotAt(deployment, proposer);

// Only the hash goes on chain; the text itself lives wherever the DAO keeps it.
const subject = keccakOfString(text);
const tx = await ballot.createProposal(subject, BigInt(Math.round(hours * 3600)));
const receipt = await tx.wait();

const created = receipt.logs
  .map((log) => { try { return ballot.interface.parseLog(log); } catch { return null; } })
  .find((parsed) => parsed?.name === 'ProposalCreated');

console.log(`proposal ${created.args.proposalId} created by ${proposer.address}`);
console.log(`  text          ${text}`);
console.log(`  subject       ${subject}`);
console.log(`  snapshot root ${created.args.membershipRoot}`);
console.log(`  anonymity set ${created.args.anonymitySetSize} members`);
console.log(`  deadline      ${new Date(Number(created.args.deadline) * 1000).toISOString()}`);
console.log(`  tx            ${receipt.hash}`);
