// Open a proposal (any NFT holder). Freezes the current member root as the
// proposal's anonymity set.
//
//   PROPOSER_KEY=0x... DESCRIPTION="Fund X?" VOTING_PERIOD=86400 node scripts/propose.mjs
import { clients, loadDeployment, requireEnv, votingAbi } from "./lib/chain.mjs";
import { keccak256, parseEventLogs, toHex } from "viem";

const { chainId, publicClient, walletClient } = await clients(requireEnv("PROPOSER_KEY"));
const dep = loadDeployment(chainId);
const description = process.env.DESCRIPTION ?? "Example proposal";
const period = BigInt(process.env.VOTING_PERIOD ?? 3600);

const hash = await walletClient.writeContract({
  address: dep.voting, abi: votingAbi, functionName: "createProposal",
  args: [keccak256(toHex(description)), period],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("createProposal reverted");
const [ev] = parseEventLogs({ abi: votingAbi, logs: receipt.logs, eventName: "ProposalCreated" });
console.log(`proposal ${ev.args.proposalId} open until ${new Date(Number(ev.args.deadline) * 1000).toISOString()}`);
console.log(`snapshot root 0x${ev.args.snapshotRoot.toString(16)}`);
