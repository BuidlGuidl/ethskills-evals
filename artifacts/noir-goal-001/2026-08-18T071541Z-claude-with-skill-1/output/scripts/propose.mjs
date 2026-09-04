/**
 * Step 2 — open a proposal.
 *
 * Sent by a member from their normal wallet; there is nothing to hide about proposing. The
 * contract snapshots the registry root here, which is what makes the anonymity set for this
 * proposal fixed and auditable — and means anyone who registers after this transaction cannot
 * vote on it.
 *
 *   npm run propose -- "Fund the grants round" 3600
 */
import { keccak256, toUtf8Bytes } from "ethers";
import { connect, accountAt, provider } from "./lib/deployment.mjs";
import { toHex32 } from "./lib/field.mjs";
import { memberAccountIndex } from "./demo-members.mjs";

const [description = "Fund the grants round", durationSeconds = "3600"] = process.argv.slice(2);

const proposer = accountAt(memberAccountIndex(0), provider());
const { voting } = connect(proposer);

const latest = await proposer.provider.getBlock("latest");
const deadline = BigInt(latest.timestamp) + BigInt(durationSeconds);

const tx = await voting.createProposal(keccak256(toUtf8Bytes(description)), deadline);
const receipt = await tx.wait();
const created = receipt.logs
  .map((l) => {
    try {
      return voting.interface.parseLog(l);
    } catch {
      return null;
    }
  })
  .find((l) => l?.name === "ProposalCreated");

console.log(`proposal ${created.args.proposalId} opened by ${proposer.address} (tx ${tx.hash})`);
console.log(`  description   "${description}"`);
console.log(`  merkle root   ${toHex32(created.args.merkleRoot)}`);
console.log(`  anonymity set ${await connect(proposer).registry.size()} members`);
console.log(`  deadline      ${new Date(Number(created.args.deadline) * 1000).toISOString()}`);
