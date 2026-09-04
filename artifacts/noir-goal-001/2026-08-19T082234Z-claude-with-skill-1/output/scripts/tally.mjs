#!/usr/bin/env node
/**
 * STEP 4 — anyone reads the result after the deadline.
 *
 *   node scripts/tally.mjs [proposalId]
 *
 * No key, no membership, no permission: `result` is a plain view call. It
 * reverts while voting is still open so the contract does not itself serve a
 * live running count (see the caveat in NOTES.md — calldata is still public).
 */
import { contracts, provider } from "./client/env.mjs";
import { toHex32 } from "./client/poseidon.mjs";

const p = provider();
const { ballot } = contracts(p);
const proposalId = BigInt(process.argv[2] ?? (await ballot.proposalCount()));

const [descriptionHash, snapshotRoot, eligibleMembers, deadline] = await ballot.proposalInfo(proposalId);
console.log(`proposal #${proposalId}`);
console.log(`  descriptionHash : ${descriptionHash}`);
console.log(`  snapshot root   : ${toHex32(snapshotRoot)}`);
console.log(`  eligible        : ${eligibleMembers}`);
console.log(`  deadline        : ${new Date(Number(deadline) * 1000).toISOString()}`);

try {
  const [yes, no, turnout] = await ballot.result(proposalId);
  console.log(`  YES ${yes} / NO ${no}   (turnout ${turnout} of ${eligibleMembers})`);
} catch (e) {
  if (String(e).includes("VotingStillOpen")) {
    console.log("  voting still open — the contract withholds the tally until the deadline");
  } else {
    throw e;
  }
}
