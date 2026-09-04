// End-to-end run on a local anvil: seed the electorate, open a proposal, cast anonymous
// ballots through a relayer, prove a double vote is impossible, then read the tally.
//
// Prereq: anvil running, and `forge script script/Deploy.s.sol --broadcast --rpc-url ...`
// already applied. See NOTES.md.
import { provider, contracts, memberWallet, relayerWallet, decodeRevert } from "./lib/chain.mjs";
import { VoteProver } from "./lib/prove.mjs";
import { seed } from "./seed.mjs";
import { propose } from "./propose.mjs";
import { castVote } from "./vote.mjs";
import { tally } from "./tally.mjs";

const BALLOTS = Number(process.env.BALLOTS ?? 12);
const rule = (t) => console.log(`\n=== ${t} ${"=".repeat(Math.max(0, 62 - t.length))}`);

const run = async () => {
  rule("1. electorate joins (each tx sent by that member's own wallet)");
  const joined = await seed();
  const { registry, voting } = contracts(provider);
  console.log(`registry has ${await registry.leafCount()} commitments, root ${await registry.root()}`);

  rule("2. a member opens a proposal (sent by that member's own wallet)");
  const { proposalId, deadline } = await propose({ votingSeconds: 3600 });

  rule("3. ballots (every tx below sent by the relayer, never by a member)");
  // One prover instance reused across ballots — proving key setup dominates otherwise.
  const prover = await VoteProver.create();
  const voters = Array.from({ length: Math.min(BALLOTS, joined) }, (_, i) => i);
  let expectedYes = 0;
  try {
    for (const i of voters) {
      const support = i % 3 !== 0; // arbitrary split, just to produce a contested result
      if (support) expectedYes++;
      await castVote({ memberIndex: i, proposalId, support, prover, quiet: i > 0 });
      if (i > 0) process.stdout.write(`  member ${i} voted ${support ? "YES" : "NO"} via relayer\n`);
    }

    rule("4. the same member tries to vote again on the same proposal");
    try {
      await castVote({ memberIndex: 0, proposalId, support: false, prover, quiet: true });
      throw new Error("FAIL: double vote was accepted");
    } catch (e) {
      const reason = decodeRevert(voting.interface, e);
      if (reason !== "NullifierAlreadyUsed") throw new Error(`expected NullifierAlreadyUsed, got: ${reason}`);
      console.log("rejected with NullifierAlreadyUsed — the nullifier is per (member, proposal),");
      console.log("so the same member can still vote once on every other proposal, unlinkably.");
    }
  } finally {
    await prover.destroy();
  }

  rule("5. what the relayer's ballots did NOT reveal");
  const logs = await voting.queryFilter(voting.filters.VoteCast(proposalId), 0, "latest");
  console.log(`${logs.length} VoteCast logs, every one of them from ${relayerWallet().address}`);
  console.log("each carries a per-proposal nullifier tag and a yes/no bit, and nothing else:");
  for (const l of logs.slice(0, 3)) {
    console.log(`  nullifier 0x${l.args.nullifierHash.toString(16).slice(0, 16)}...  ${l.args.support ? "YES" : "NO"}`);
  }
  console.log(`member 0's wallet ${memberWallet(0).address} sent 0 of them.`);

  rule("6. deadline passes, anyone reads the tally");
  await provider.send("evm_setNextBlockTimestamp", [Number(deadline) + 1]);
  await provider.send("evm_mine", []);
  const result = await tally({ proposalId });

  if (Number(result.yes) !== expectedYes || Number(result.yes + result.no) !== voters.length) {
    throw new Error(`tally mismatch: expected ${expectedYes} yes of ${voters.length}`);
  }
  console.log("\ntally matches the ballots cast. Nothing onchain says who cast which.");
};

run().catch((e) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
