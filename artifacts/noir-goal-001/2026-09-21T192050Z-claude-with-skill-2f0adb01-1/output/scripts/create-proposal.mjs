// Open a proposal (any member wallet). Snapshots the current member-tree root.
//   MEMBER_PRIVATE_KEY=0x... node scripts/create-proposal.mjs --description "Fund X?" --period 86400
import { keccak256, toHex, parseEventLogs } from "viem";
import { arg, clients, isMain, loadAbi, loadDeployment } from "./lib/common.mjs";

export async function createProposal({ memberKey, description, period }) {
  const d = loadDeployment();
  const { publicClient, walletClient } = clients(memberKey);
  const abi = loadAbi("AnonVoting");
  const { request } = await publicClient.simulateContract({
    account: walletClient.account,
    address: d.anonVoting,
    abi,
    functionName: "createProposal",
    args: [keccak256(toHex(description)), BigInt(period)],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const [ev] = parseEventLogs({ abi, logs: receipt.logs, eventName: "ProposalCreated" });
  console.log(`proposal #${ev.args.proposalId} open until ${new Date(Number(ev.args.deadline) * 1000).toISOString()}, anonymity set ${ev.args.memberCount}`);
  return ev.args.proposalId;
}

if (isMain(import.meta.url)) {
  await createProposal({
    memberKey: process.env.MEMBER_PRIVATE_KEY,
    description: arg("description"),
    period: arg("period", "86400"),
  });
}
