#!/usr/bin/env node
//   MEMBER_PRIVATE_KEY=0x.. node js/proposal.mjs create "<proposal text>" [votingPeriodSeconds]
//   node js/proposal.mjs tally <proposalId>
import { ethers } from "ethers";
import { connect, rpcUrl } from "./common/contracts.mjs";

export async function createProposal(memberWallet, text, periodSeconds) {
  const { voting } = await connect(memberWallet);
  const tx = await voting.createProposal(ethers.id(text), periodSeconds);
  const rcpt = await tx.wait();
  const ev = rcpt.logs.map((l) => voting.interface.parseLog(l)).find((e) => e?.name === "ProposalCreated");
  return { proposalId: ev.args.proposalId, deadline: ev.args.deadline, memberCount: ev.args.memberCount };
}

export async function readTally(provider, proposalId) {
  const { voting } = await connect(provider);
  const [yes, no, eligible] = await voting.tally(proposalId);
  return { yes, no, eligible };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg, period] = process.argv.slice(2);
  const provider = new ethers.JsonRpcProvider(rpcUrl());
  if (cmd === "create" && arg && process.env.MEMBER_PRIVATE_KEY) {
    const w = new ethers.Wallet(process.env.MEMBER_PRIVATE_KEY, provider);
    const r = await createProposal(w, arg, BigInt(period ?? 3 * 24 * 3600));
    console.log(`proposal ${r.proposalId}: ${r.memberCount} eligible members, deadline ${r.deadline}`);
  } else if (cmd === "tally" && arg) {
    const t = await readTally(provider, BigInt(arg));
    console.log(`proposal ${arg}: yes ${t.yes}, no ${t.no}, eligible ${t.eligible}`);
  } else {
    console.error('usage: MEMBER_PRIVATE_KEY=0x.. node js/proposal.mjs create "<text>" [periodSeconds] | tally <id>');
    process.exit(1);
  }
}
