// Proposal lifecycle helpers (not part of the anonymous path).
//
//   PROPOSER_PRIVATE_KEY=0x.. node scripts/proposal.mjs create "Fund the grants round" 3600
//   node scripts/proposal.mjs tally 1
import { ethers } from "ethers";
import { connect, env } from "./lib.mjs";

const ctx = await connect();
const [cmd, ...args] = process.argv.slice(2);

if (cmd === "create") {
  // Sent by any NFT holder; the proposer is public, like any governance proposal.
  const [text, seconds = "3600"] = args;
  const proposer = new ethers.Wallet(env("PROPOSER_PRIVATE_KEY"), ctx.provider);
  const now = (await ctx.provider.getBlock("latest")).timestamp;
  const tx = await ctx.voting.connect(proposer).createProposal(ethers.id(text), BigInt(now) + BigInt(seconds));
  const rcpt = await tx.wait();
  const ev = rcpt.logs.map((l) => ctx.voting.interface.parseLog(l)).find((e) => e?.name === "ProposalCreated");
  console.log(`proposal ${ev.args.id} created; electorate ${ev.args.electorate}; deadline ${ev.args.deadline}`);
} else if (cmd === "tally") {
  // A read, not a transaction: anyone can run it after the deadline.
  const [yes, no, electorate] = await ctx.voting.tally(BigInt(args[0]));
  console.log(`proposal ${args[0]}: yes ${yes}, no ${no}, abstained/absent ${electorate - yes - no} of ${electorate}`);
} else {
  console.error("usage: proposal.mjs create <text> [seconds] | tally <id>");
  process.exit(1);
}
