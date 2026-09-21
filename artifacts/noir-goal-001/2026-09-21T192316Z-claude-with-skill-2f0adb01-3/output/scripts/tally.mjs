// Anyone: read a proposal's result after the deadline.
//   PROPOSAL_ID=1 node scripts/tally.mjs
import { connect, votingAbi } from "./lib/common.mjs";

const proposalId = BigInt(process.env.PROPOSAL_ID ?? "1");
const { deployment, publicClient } = await connect();
const [yes, no, eligible] = await publicClient.readContract({
  address: deployment.voting, abi: votingAbi, functionName: "tally", args: [proposalId],
});
console.log(`proposal ${proposalId}: yes=${yes} no=${no} turnout=${yes + no}/${eligible}`);
