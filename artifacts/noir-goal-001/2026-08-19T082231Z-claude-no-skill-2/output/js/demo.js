#!/usr/bin/env node
/**
 * Full end-to-end run against a local chain: register members, open a proposal,
 * cast three anonymous ballots through a relayer, close voting, read the tally.
 *
 * `js/vote.js` is the script that shows one member's path in detail; this one exists
 * to prove the whole thing actually works, and to make the privacy properties
 * visible - watch what the relayer's transactions do and do not reveal.
 *
 *   bash scripts/deploy-local.sh
 *   node js/demo.js
 */
import { Identity, voteScope } from "./core/identity.js";
import { connect, wallet, readMemberLeaves, findUnregisteredToken, ANVIL_KEYS, DEFAULT_RPC } from "./core/chain.js";
import { buildTree, merkleProof } from "./core/tree.js";
import { toHex32 } from "./core/hash.js";
import { proveBallot, shutdownProver } from "./core/prover.js";
import { parseArgs, step, info, warn, fail } from "./core/cli.js";

/** Accounts 1..8 hold membership NFTs (see scripts/deploy-local.sh MEMBER_COUNT). */
const MEMBER_ACCOUNTS = [1, 2, 3, 4, 5, 6, 7, 8];
/** Account 9 holds no NFT. It is the relayer: it pays gas and learns nothing. */
const RELAYER_ACCOUNT = 9;

const VOTING_PERIOD = 3600; // seconds; PrivateBallot.MIN_VOTING_PERIOD

async function main() {
  const args = parseArgs();
  const rpcUrl = args.rpc ?? DEFAULT_RPC;
  const { provider, registry, ballot, nft, deployment } = await connect({ rpcUrl });

  const relayer = wallet(ANVIL_KEYS[RELAYER_ACCOUNT], provider);
  const members = MEMBER_ACCOUNTS.map((account) => ({
    account,
    wallet: wallet(ANVIL_KEYS[account], provider),
    identity: Identity.fromPassphrase(`demo member ${account}`),
  }));

  // ------------------------------------------------------------ registration
  step(1, "Members publish voting keys (each from their own NFT-holding wallet)");
  for (const member of members) {
    if ((await nft.balanceOf(member.wallet.address)) === 0n) {
      fail(`account ${member.account} holds no membership NFT - redeploy with MEMBER_COUNT=8`);
    }
    const tokenId = await findUnregisteredToken(nft, registry, member.wallet.address);
    if (tokenId === null) continue; // already registered on a previous run
    const tx = await registry
      .connect(member.wallet)
      .register(tokenId, toHex32(member.identity.commitment));
    await tx.wait();
  }
  const leaves = await readMemberLeaves(registry);
  info("members registered", leaves.length);
  info("registry root", await registry.root());
  info("recomputed offchain", toHex32(buildTree(leaves).root));

  // -------------------------------------------------------------- a proposal
  step(2, "A member opens a proposal");
  const proposer = members[0].wallet;
  const createTx = await ballot
    .connect(proposer)
    .createProposal("Fund the audit from the treasury?", VOTING_PERIOD);
  const createReceipt = await createTx.wait();
  const proposalId = (await ballot.proposalCount()) - 1n;
  const proposal = await ballot.getProposal(proposalId);
  info("proposal id", proposalId.toString());
  info("opened by", proposer.address);
  info("tx", createReceipt.hash);
  info("pinned root", proposal.root);
  info("anonymity set", `${proposal.eligible} members`);

  // ----------------------------------------------------------------- ballots
  step(3, "Three members vote, each via the relayer");
  warn("the relayer holds no NFT, sends every ballot, and cannot tell who any of them");
  warn("came from. Neither can anyone reading the chain afterwards.");

  const tree = buildTree(leaves);
  const scope = voteScope(deployment.privateBallot, proposalId);
  const ballots = [
    { member: members[2], support: true },
    { member: members[5], support: false },
    { member: members[0], support: true },
  ];

  for (const { member, support } of ballots) {
    const leafIndex = leaves.findIndex((leaf) => leaf === member.identity.commitment);
    const { siblings, pathBits } = merkleProof(tree, leafIndex);
    const nullifier = member.identity.nullifier(scope);

    const started = Date.now();
    const { proof } = await proveBallot({
      root: tree.root,
      scope,
      nullifier,
      support,
      relayer: relayer.address,
      secret: member.identity.secret,
      pathBits,
      siblings,
    });

    const tx = await ballot.connect(relayer).castVote(proposalId, support, toHex32(nullifier), proof);
    const receipt = await tx.wait();
    console.log(
      `    ballot from leaf ${String(leafIndex).padStart(2)} (never disclosed): ` +
        `${support ? "yes" : "no "}  proof ${((Date.now() - started) / 1000).toFixed(1)}s  ` +
        `gas ${receipt.gasUsed}  sender ${receipt.from}`,
    );
  }

  // ---------------------------------------------------------- double-vote try
  step(4, "The same member tries to vote twice");
  const repeat = ballots[0];
  const leafIndex = leaves.findIndex((leaf) => leaf === repeat.member.identity.commitment);
  const { siblings, pathBits } = merkleProof(tree, leafIndex);
  const nullifier = repeat.member.identity.nullifier(scope);
  const { proof } = await proveBallot({
    root: tree.root,
    scope,
    nullifier,
    support: false, // a different answer this time, and a genuinely valid proof
    relayer: relayer.address,
    secret: repeat.member.identity.secret,
    pathBits,
    siblings,
  });
  try {
    await ballot.connect(relayer).castVote.staticCall(proposalId, false, toHex32(nullifier), proof);
    fail("the double vote was accepted - that is a bug");
  } catch (err) {
    info("rejected with", err.revert?.name ?? err.shortMessage ?? err.message);
  }

  // ------------------------------------------------------------------- tally
  step(5, "Close voting and read the tally");
  try {
    await ballot.tally(proposalId);
    warn("tally() answered while voting was still open - that is a bug");
  } catch {
    info("tally() before deadline", "reverts (VotingStillOpen)");
  }
  await provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
  await provider.send("evm_mine", []);
  const [yes, no, eligible] = await ballot.tally(proposalId);
  info("yes", yes.toString());
  info("no", no.toString());
  info("eligible members", eligible.toString());
  info("turnout", `${yes + no} of ${eligible}`);

  console.log(
    "\nThe chain now records three ballots and their result. It records no mapping from\n" +
      "any of them to a member, and there is no key anyone - including the DAO - can use\n" +
      "to build one.\n",
  );
}

try {
  await main();
} catch (err) {
  await shutdownProver();
  fail(err.stack ?? err.message);
}
await shutdownProver();
process.exit(0);
