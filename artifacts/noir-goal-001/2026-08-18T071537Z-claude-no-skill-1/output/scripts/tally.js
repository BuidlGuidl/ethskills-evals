#!/usr/bin/env node
// Read the result. No wallet, no transaction -- anyone can call this.
//
//   PROPOSAL_ID=0 node scripts/tally.js

import { connect } from "./lib/deployment.js";

const proposalId = BigInt(process.env.PROPOSAL_ID ?? 0);
const { provider, ballot } = await connect();

const proposal = await ballot.getProposal(proposalId);
const now = (await provider.getBlock("latest")).timestamp;
const closed = now > Number(proposal.deadline);

console.log(`proposal        #${proposalId}`);
console.log(`anonymity set   ${proposal.memberCount} enrolled members`);
console.log(`deadline        ${new Date(Number(proposal.deadline) * 1000).toISOString()}`);
console.log(`status          ${closed ? "closed" : "open"}`);

if (!closed) {
  // The counts are on chain and in the events either way; result() just refuses
  // to present a half-finished vote as a result. See NOTES.md.
  console.log(`running count   ${proposal.yesVotes} yes / ${proposal.noVotes} no (not final)`);
  process.exit(0);
}

const [yes, no, passed] = await ballot.result(proposalId);
console.log(`tally           ${yes} yes / ${no} no`);
console.log(`outcome         ${passed ? "PASSED" : "REJECTED"}`);
console.log(`turnout         ${Number(yes) + Number(no)} of ${proposal.memberCount}`);
