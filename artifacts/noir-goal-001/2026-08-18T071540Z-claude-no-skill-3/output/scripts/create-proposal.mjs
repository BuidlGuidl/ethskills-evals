// The DAO admin opens a proposal.
//
// Sent by the admin wallet. It snapshots the member root, so the anonymity set
// for this vote is fixed at this moment and cannot be changed underneath voters.
//
//   npm run propose
//   DESCRIPTION="..." VOTING_PERIOD=3600 npm run propose

import { provider, loadDeployment, contractAt, adminWallet } from "./common/deployment.mjs";

const DESCRIPTION = process.env.DESCRIPTION ?? "Fund the grants program with 250k from treasury?";
const VOTING_PERIOD = Number(process.env.VOTING_PERIOD ?? 3600);

async function main() {
  const rpc = provider();
  const deployment = loadDeployment(Number((await rpc.getNetwork()).chainId));
  const admin = adminWallet(rpc);
  const ballot = contractAt("PrivateBallot", deployment.privateBallot, admin);

  // Fail early with a readable message rather than an opaque estimateGas revert.
  const registry = contractAt("MemberRegistry", deployment.memberRegistry, rpc);
  const [members, minimum] = [await registry.memberCount(), await ballot.minAnonymitySet()];
  if (members < minimum) {
    throw new Error(
      `Only ${members} members have registered; this ballot requires at least ${minimum} ` +
        `before a proposal can open, so that no vote is hidden in a crowd too small to hide in.\n` +
        `Run: COUNT=${minimum} npm run register`,
    );
  }

  const tx = await ballot.createProposal(DESCRIPTION, VOTING_PERIOD);
  const receipt = await tx.wait();

  const proposalId = await ballot.proposalCount();
  const proposal = await ballot.getProposal(proposalId);

  console.log(`Proposal #${proposalId} opened by admin ${admin.address}`);
  console.log(`  tx              : ${receipt.hash}`);
  console.log(`  description     : ${proposal.description}`);
  console.log(`  member root     : ${proposal.memberRoot}`);
  console.log(`  anonymity set   : ${proposal.anonymitySetSize} members`);
  console.log(`  voting ends     : ${new Date(Number(proposal.votingEnds) * 1000).toISOString()}`);
  console.log(`\nA chain observer learns: a proposal exists, its text, its deadline,`);
  console.log(`and how many members could vote. Nothing about anyone's intent.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
