#!/usr/bin/env node
/**
 * Read the result. No key, no membership and no permission required - after the
 * deadline the tally is public, which is the whole point of putting it onchain.
 *
 *   node js/tally.js --proposal 0
 */
import { connect, DEFAULT_RPC } from "./core/chain.js";
import { parseArgs, step, info, fail } from "./core/cli.js";

async function main() {
  const args = parseArgs();
  const proposalId = BigInt(args.proposal ?? 0);
  const { provider, ballot } = await connect({ rpcUrl: args.rpc ?? DEFAULT_RPC });

  const proposal = await ballot.getProposal(proposalId);
  const now = (await provider.getBlock("latest")).timestamp;

  step(1, "Proposal");
  info("id", proposalId.toString());
  info("description", proposal.description);
  info("eligible members", proposal.eligible.toString());
  info("voting ends", new Date(Number(proposal.votingEnds) * 1000).toISOString());

  if (now < Number(proposal.votingEnds)) {
    step(2, "Still open");
    info("tally()", "reverts until the deadline passes");
    return;
  }

  step(2, "Result");
  const [yes, no, eligible] = await ballot.tally(proposalId);
  info("yes", yes.toString());
  info("no", no.toString());
  info("turnout", `${yes + no} of ${eligible}`);
  info("outcome", yes > no ? "passed" : yes === no ? "tied" : "rejected");

  step(3, "Ballots on record");
  const events = await ballot.queryFilter(ballot.filters.VoteCast(proposalId), 0, "latest");
  for (const ev of events) {
    console.log(
      `    nullifier ${ev.args.nullifier}  ${ev.args.support ? "yes" : "no "}  ` +
        `submitted by ${ev.transactionHash.slice(0, 10)}...`,
    );
  }
  console.log(
    "\nEach line is a ballot nobody can attribute. The nullifiers are unlinkable to the\n" +
      "commitments in MemberRegistry without the corresponding member's secret.\n",
  );
}

main().catch((err) => fail(err.stack ?? err.message));
