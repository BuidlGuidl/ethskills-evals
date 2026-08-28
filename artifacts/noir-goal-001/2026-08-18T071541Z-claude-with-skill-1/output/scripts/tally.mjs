/**
 * Step 4 — read the result.
 *
 * No transaction, no privileged access: `result()` is a view call anyone can make once the
 * deadline has passed. There is no decryption step and no trusted tallier, because the ballots
 * were never encrypted — only their authors were hidden.
 *
 *   npm run tally -- 1
 */
import { connect, provider } from "./lib/deployment.mjs";
import { toHex32 } from "./lib/field.mjs";

const proposalId = BigInt(process.argv[2] ?? "1");
const p = provider();
const { voting } = connect(p);

const proposal = await voting.getProposal(proposalId);
const now = (await p.getBlock("latest")).timestamp;
const closed = BigInt(now) >= proposal.deadline;

console.log(`proposal ${proposalId}`);
console.log(`  snapshot root ${toHex32(proposal.merkleRoot)}`);
console.log(`  deadline      ${new Date(Number(proposal.deadline) * 1000).toISOString()} (${closed ? "closed" : "open"})`);

if (!closed) {
  console.log(`  running tally yes ${proposal.yesVotes} / no ${proposal.noVotes}  (not final)`);
  process.exit(0);
}

const [yesVotes, noVotes, passed] = await voting.result(proposalId);
console.log(`  final tally   yes ${yesVotes} / no ${noVotes}`);
console.log(`  outcome       ${passed ? "PASSED" : "REJECTED"}`);
