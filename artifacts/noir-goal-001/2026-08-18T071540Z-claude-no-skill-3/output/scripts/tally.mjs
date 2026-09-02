// Read the result. Anyone can run this; no key required.
//
//   npm run tally
//   PROPOSAL=1 npm run tally

import { provider, loadDeployment, contractAt } from "./common/deployment.mjs";

async function main() {
  const rpc = provider();
  const deployment = loadDeployment(Number((await rpc.getNetwork()).chainId));
  const ballot = contractAt("PrivateBallot", deployment.privateBallot, rpc);

  const proposalId = BigInt(process.env.PROPOSAL ?? (await ballot.proposalCount()));
  if (proposalId === 0n) throw new Error("no proposals yet");
  const proposal = await ballot.getProposal(proposalId);

  console.log(`Proposal #${proposalId}: ${proposal.description}`);
  console.log(`  anonymity set : ${proposal.anonymitySetSize} members`);
  console.log(`  turnout       : ${await ballot.turnout(proposalId)}`);
  console.log(`  voting ends   : ${new Date(Number(proposal.votingEnds) * 1000).toISOString()}`);

  try {
    const [yes, no] = await ballot.tally(proposalId);
    console.log(`\n  RESULT: ${yes} yes / ${no} no  ->  ${yes > no ? "PASSED" : "REJECTED"}`);
  } catch {
    console.log(`\n  Voting is still open; the tally is sealed until the deadline.`);
    console.log(`  (On a local chain: cast rpc evm_increaseTime <seconds> && cast rpc evm_mine)`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
