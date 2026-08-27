#!/usr/bin/env node
// Open a proposal. Sent from a MEMBER'S OWN WALLET.
//
// Proposing is public on purpose: an observer learns who proposed what, and
// which member set the vote will be judged against. Neither of those is a
// secret -- only the ballots are.
//
//   MEMBER_KEY=0x... TEXT="Fund the grants program" HOURS=72 node scripts/propose.js

import { keccak256, toUtf8Bytes } from "ethers";
import { ANVIL_KEYS, connect, wallet } from "./lib/deployment.js";

const text = process.env.TEXT || "Allocate 50 ETH from the treasury to the grants program";
const hours = Number(process.env.HOURS ?? 72);

const { provider, memberSet, ballot } = await connect();
const member = wallet(process.env.MEMBER_KEY || ANVIL_KEYS.member, provider);

const deadline = (await provider.getBlock("latest")).timestamp + hours * 3600;
const descriptionHash = keccak256(toUtf8Bytes(text));

console.log(`proposer          ${member.address}`);
console.log(`text              "${text}"`);
console.log(`description hash  ${descriptionHash}   (publish the text off chain)`);
console.log(`deadline          ${new Date(deadline * 1000).toISOString()}`);
console.log(`member set now    ${await memberSet.memberCount()} enrolled, root ${await memberSet.root()}`);

const tx = await ballot.connect(member).createProposal(descriptionHash, deadline);
await tx.wait();

const proposalId = (await ballot.proposalCount()) - 1n;
const proposal = await ballot.getProposal(proposalId);
console.log(`\ncreateProposal() tx ${tx.hash}  (sender: a member's own wallet)`);
console.log(`proposal id       ${proposalId}`);
console.log(`snapshot          ${proposal.memberCount} members, root ${proposal.memberRoot}`);
console.log(`
The snapshot is fixed here. Members who enrol from now on cannot vote on this
proposal -- which is also what stops anyone adding leaves mid-vote.`);
