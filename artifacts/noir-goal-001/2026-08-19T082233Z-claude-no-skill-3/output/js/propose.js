/**
 * Step 2 of the flow: open a proposal.
 *
 * Sends ONE transaction, from a member's public wallet:
 *     PrivateBallot.createProposal(descriptionHash, votingPeriod)
 *
 * The proposal freezes the membership root, so the electorate cannot change
 * underneath a running vote.
 *
 *   node js/propose.js --text "Fund the grants round?" [--hours 24]
 */
import { keccak256, toUtf8Bytes } from "ethers";
import { ANVIL_KEYS, connect, parseArgs } from "./core/chain.js";

const args = parseArgs();
const { ballot, registry, wallet } = await connect();

const proposer = wallet(args["proposer-key"] ?? process.env.PROPOSER_KEY ?? ANVIL_KEYS[0]);
const text = args.text ?? "Fund the grants round?";
const hours = Number(args.hours ?? 24);

const tx = await ballot.connect(proposer).createProposal(keccak256(toUtf8Bytes(text)), BigInt(hours) * 3600n);
const receipt = await tx.wait();
const proposalId = await ballot.proposalCount();
const [, membershipRoot, votingEnds, electorate] = await ballot.proposalInfo(proposalId);

console.log("tx 2  createProposal()");
console.log("  from       ", proposer.address, "(a member, in the open)");
console.log("  hash       ", receipt.hash);
console.log("  gas used   ", receipt.gasUsed.toString());
console.log("  proposal   ", proposalId.toString(), JSON.stringify(text));
console.log("  snapshot   ", "0x" + membershipRoot.toString(16).padStart(64, "0"));
console.log("  electorate ", electorate.toString(), "of", (await registry.memberCount()).toString(), "registered leaves");
console.log("  closes at  ", new Date(Number(votingEnds) * 1000).toISOString());
console.log("\nobserver learns: who opened the proposal, and which membership snapshot counts.");
