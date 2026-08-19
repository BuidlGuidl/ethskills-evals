// Step 2 of the flow: open a proposal.
//
// SENT BY: any member's own wallet (the contract requires a membership badge).
// AN OBSERVER LEARNS: the proposal text hash, the deadline, and the voter-tree root and
// electorate size frozen at this moment. Nothing private — but note that this snapshot is
// what fixes the anonymity set: only members who had already joined can vote on it.
//
// Usage: PROPOSER_INDEX=0 VOTING_SECONDS=3600 TEXT="Ship v2" node js/propose.mjs
import { keccak256, toUtf8Bytes } from "ethers";
import { contracts, memberWallet, provider } from "./lib/chain.mjs";

export async function propose({
  proposerIndex = Number(process.env.PROPOSER_INDEX ?? 0),
  text = process.env.TEXT ?? "Should the DAO ship v2?",
  votingSeconds = Number(process.env.VOTING_SECONDS ?? 3600),
  quiet = false,
} = {}) {
  const proposer = memberWallet(proposerIndex);
  const { voting } = contracts(proposer);

  const now = (await provider.getBlock("latest")).timestamp;
  const deadline = now + votingSeconds;
  const descriptionHash = keccak256(toUtf8Bytes(text));

  const tx = await voting.createProposal(descriptionHash, deadline);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((l) => { try { return voting.interface.parseLog(l); } catch { return null; } })
    .find((l) => l?.name === "ProposalCreated");
  const proposalId = event.args.proposalId;

  if (!quiet) {
    console.log(`proposal ${proposalId} opened by member ${proposerIndex} (${proposer.address})`);
    console.log(`  tx             ${receipt.hash}`);
    console.log(`  text           ${JSON.stringify(text)}`);
    console.log(`  root snapshot  ${event.args.root}`);
    console.log(`  electorate     ${event.args.electorateSize} members may vote`);
    console.log(`  deadline       ${new Date(Number(deadline) * 1000).toISOString()}`);
  }
  return { proposalId, deadline, receipt };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  propose().catch((e) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
}
