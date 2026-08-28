#!/usr/bin/env node
// Step 2 of the member flow: open a proposal.
//
//   node js/create-proposal.mjs --member-key 0x<privkey> \
//     --description "Fund the grants round" --period 3600
//
// Sent by any member wallet. Pins the current member-tree root: the eligible set
// for this proposal is frozen here, so nobody can add commitments mid-vote.

import { Wallet } from "ethers";
import { anonVoting, loadDeployment, provider } from "./lib/contracts.mjs";
import { parseArgs } from "./lib/args.mjs";

const args = parseArgs();
const memberKey = args["member-key"] ?? process.env.MEMBER_PRIVATE_KEY;
if (!memberKey) throw new Error("pass --member-key 0x... or set MEMBER_PRIVATE_KEY");

const description = args.description ?? "Untitled proposal";
const period = Number(args.period ?? 3600);

const deployment = await loadDeployment();
const rpc = provider(args.rpc);
const member = new Wallet(memberKey, rpc);
const voting = anonVoting(deployment.anonVoting, member);

const tx = await voting.createProposal(description, period);
const receipt = await tx.wait();
const event = receipt.logs
  .map((log) => {
    try {
      return voting.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .find((parsed) => parsed?.name === "ProposalCreated");

console.log(`createProposal() tx : ${receipt.hash}  (from ${member.address})`);
console.log(`proposal id         : ${event.args.proposalId}`);
console.log(`pinned root         : ${event.args.root}`);
console.log(`anonymity set       : ${event.args.memberCount} members`);
console.log(`deadline            : ${new Date(Number(event.args.deadline) * 1000).toISOString()}`);

rpc.destroy(); // stop the ethers poller so the script exits
