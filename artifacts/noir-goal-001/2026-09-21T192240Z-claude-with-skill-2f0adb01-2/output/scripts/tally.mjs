// Read the result after the deadline. No wallet needed.
//   PROPOSAL_ID=0 node scripts/tally.mjs
import { clients, loadDeployment, requireEnv, votingAbi } from "./lib/chain.mjs";

const proposalId = BigInt(requireEnv("PROPOSAL_ID"));
const { chainId, publicClient } = await clients();
const dep = loadDeployment(chainId);

const [yes, no, passed] = await publicClient.readContract({
  address: dep.voting, abi: votingAbi, functionName: "result", args: [proposalId],
});
// Cross-check against the public VoteCast log: anyone can recount.
const logs = await publicClient.getContractEvents({
  address: dep.voting, abi: votingAbi, eventName: "VoteCast", args: { proposalId }, fromBlock: dep.deployBlock,
});
const recount = logs.reduce((a, l) => (l.args.support ? { ...a, yes: a.yes + 1n } : { ...a, no: a.no + 1n }), { yes: 0n, no: 0n });
if (recount.yes !== yes || recount.no !== no) throw new Error("event recount disagrees with storage");
console.log(`proposal ${proposalId}: yes ${yes}, no ${no} → ${passed ? "PASSED" : "REJECTED"}`);
