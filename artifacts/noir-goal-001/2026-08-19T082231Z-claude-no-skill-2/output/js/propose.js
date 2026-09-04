#!/usr/bin/env node
/**
 * Open a proposal. Sent by a member's own wallet - openly, like any other governance
 * action. The thing this transaction fixes forever is the member tree root, which is
 * the anonymity set every ballot on this proposal will hide inside.
 *
 *   node js/propose.js --key 0x<member wallet key> --text "Fund the audit?" --hours 72
 */
import { connect, wallet, DEFAULT_RPC } from "./core/chain.js";
import { parseArgs, step, info, warn, fail } from "./core/cli.js";

async function main() {
  const args = parseArgs();
  const memberKey = args.key ?? process.env.MEMBER_PK;
  if (!memberKey || memberKey === true) fail("pass --key 0x<member wallet key> (or set MEMBER_PK)");

  const text = args.text && args.text !== true ? args.text : "Untitled proposal";
  const hours = Number(args.hours ?? 72);
  const votingPeriod = Math.round(hours * 3600);

  const { provider, registry, ballot } = await connect({ rpcUrl: args.rpc ?? DEFAULT_RPC });
  const proposer = wallet(memberKey, provider);

  step(1, "Snapshot the electorate");
  const [memberCount, root] = await Promise.all([registry.memberCount(), registry.root()]);
  info("registered members", memberCount.toString());
  info("root to be pinned", root);
  if (memberCount < 3n) {
    warn("a handful of registered members is a handful of places to hide - wait for");
    warn("registrations to catch up before running anything contested.");
  }

  step(2, "Create the proposal");
  const tx = await ballot.connect(proposer).createProposal(text, votingPeriod);
  const receipt = await tx.wait();
  const proposalId = (await ballot.proposalCount()) - 1n;
  const proposal = await ballot.getProposal(proposalId);

  info("proposal id", proposalId.toString());
  info("tx hash", receipt.hash);
  info("sent by", proposer.address);
  info("voting ends", new Date(Number(proposal.votingEnds) * 1000).toISOString());
  info("anonymity set", `${proposal.eligible} members`);

  console.log(
    "\nWhat a chain observer learns from this transaction: which member opened the\n" +
      "proposal, its text, its deadline, and the member set eligible to vote on it.\n",
  );
}

main().catch((err) => fail(err.stack ?? err.message));
