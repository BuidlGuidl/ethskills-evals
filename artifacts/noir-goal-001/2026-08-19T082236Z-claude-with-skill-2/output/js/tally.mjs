// Step 4 of the flow: read the result.
//
// SENT BY: nobody — it is a view call, free and permissionless. AnonVoting.tally() reverts
// until the deadline passes, so the *official* result is a post-deadline object.
//
// Usage: PROPOSAL_ID=1 node js/tally.mjs
import { contracts, provider } from "./lib/chain.mjs";

export async function tally({ proposalId = BigInt(process.env.PROPOSAL_ID ?? 1), quiet = false } = {}) {
  const { voting } = contracts(provider);
  const proposal = await voting.getProposal(proposalId);
  const [yes, no] = await voting.tally(proposalId);

  if (!quiet) {
    console.log(`proposal ${proposalId} final tally`);
    console.log(`  yes         ${yes}`);
    console.log(`  no          ${no}`);
    console.log(`  turnout     ${yes + no} of ${proposal.electorateSize}`);
    console.log(`  result      ${yes > no ? "PASSED" : "REJECTED"}`);
  }
  return { yes, no, electorateSize: proposal.electorateSize };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  tally().catch((e) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
}
