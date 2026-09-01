/**
 * Step 4 of the flow: read the result.
 *
 * No transaction, no privileged key - `tally()` is a public view call that
 * anyone can make once the deadline has passed.
 *
 *   node js/tally.js --proposal 1 [--warp]
 *     --warp   local chains only: jump past the deadline so the demo does not
 *              have to wait for real time to pass
 */
import { connect, parseArgs } from "./core/chain.js";

const args = parseArgs();
const { ballot, provider } = await connect();
const proposalId = BigInt(args.proposal ?? 1);

const [, , votingEnds, electorate] = await ballot.proposalInfo(proposalId);
const now = (await provider.getBlock("latest")).timestamp;

if (now < Number(votingEnds)) {
  if (!args.warp) {
    console.log(`voting is still open until ${new Date(Number(votingEnds) * 1000).toISOString()}`);
    console.log("the tally is only final after the deadline (pass --warp on a local chain)");
    process.exit(0);
  }
  await provider.send("evm_increaseTime", [Number(votingEnds) - now + 1]);
  await provider.send("evm_mine", []);
  console.log("(local chain fast-forwarded past the deadline)\n");
}

const [yes, no, snapshotSize] = await ballot.tally(proposalId);
const cast = Number(yes) + Number(no);

console.log(`proposal ${proposalId}`);
console.log("  yes       ", yes.toString());
console.log("  no        ", no.toString());
console.log("  turnout   ", `${cast} of ${electorate.toString()} members (${snapshotSize.toString()} in the snapshot)`);
console.log("  result    ", yes > no ? "PASSED" : "REJECTED");
console.log("\nthe result is public and verifiable; which member is behind any one ballot is not recoverable,");
console.log("not by the DAO, not by the relayer, not by anyone replaying the chain.");
