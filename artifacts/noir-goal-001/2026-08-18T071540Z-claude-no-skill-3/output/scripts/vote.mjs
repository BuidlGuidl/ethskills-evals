// One member, one proposal: from their secret to a submitted vote.
//
//   npm run vote                          # member 0 votes yes on the latest proposal
//   MEMBER=7 SUPPORT=no PROPOSAL=1 npm run vote
//
// The five steps below are the whole member-side protocol. Steps 1-4 are
// offline: no RPC write, no signature broadcast, nothing observable. Only step 5
// touches the chain, and it is sent by a wallet that is not the member's.

import {
  provider,
  loadDeployment,
  contractAt,
  memberWallet,
  relayerWallet,
  loadAbi,
} from "./common/deployment.mjs";
import { deriveSecret, commitmentFromSecret, nullifierFor } from "./common/crypto.mjs";
import { loadMemberTree, membershipWitness } from "./common/registry.mjs";
import { generateVoteProof } from "./common/prove.mjs";
import { formatEther, Interface } from "ethers";

/** Decode a PrivateBallot custom error out of whatever ethers wrapped it in. */
function ballotErrorName(err) {
  const data = err?.data ?? err?.info?.error?.data ?? err?.error?.data;
  if (typeof data !== "string" || data.length < 10) return undefined;
  try {
    return new Interface(loadAbi("PrivateBallot")).parseError(data)?.name;
  } catch {
    return undefined;
  }
}

const MEMBER_INDEX = Number(process.env.MEMBER ?? 0);
const SUPPORT = (process.env.SUPPORT ?? "yes").toLowerCase();
const VOTE = SUPPORT === "yes" || SUPPORT === "1" ? 1n : 0n;

const hex = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");
const step = (n, title) => console.log(`\n── ${n}. ${title} ${"─".repeat(Math.max(0, 52 - title.length))}`);

async function main() {
  const rpc = provider();
  const deployment = loadDeployment(Number((await rpc.getNetwork()).chainId));
  const registry = contractAt("MemberRegistry", deployment.memberRegistry, rpc);
  const ballot = contractAt("PrivateBallot", deployment.privateBallot, rpc);

  const proposalId = BigInt(process.env.PROPOSAL ?? (await ballot.proposalCount()));
  if (proposalId === 0n) throw new Error("no proposals yet -- run: npm run propose");
  const proposal = await ballot.getProposal(proposalId);

  console.log(`Proposal #${proposalId}: ${proposal.description}`);
  console.log(`Voting as member ${MEMBER_INDEX}, casting ${VOTE === 1n ? "YES" : "NO"}`);

  // ---------------------------------------------------------------------------
  step(1, "Derive the voting secret (offline)");
  // ---------------------------------------------------------------------------
  // The member signs a fixed message with their NFT-holding wallet. The
  // signature is deterministic, so the secret is reproducible on any device and
  // never has to be stored. It is never sent anywhere.
  const member = memberWallet(MEMBER_INDEX, rpc);
  const secret = await deriveSecret(member);
  const commitment = commitmentFromSecret(secret);

  console.log(`   member wallet : ${member.address}   (holds membership NFT #${MEMBER_INDEX})`);
  console.log(`   secret        : ${hex(secret).slice(0, 14)}…  (never leaves this machine)`);
  console.log(`   commitment    : ${hex(commitment)}`);

  // ---------------------------------------------------------------------------
  step(2, "Rebuild the member tree from public chain data");
  // ---------------------------------------------------------------------------
  // Rebuilt locally and checked against registry.root(). If the DAO ever
  // published a root that did not follow from the registered commitments, this
  // throws and the member does not vote.
  const { tree, commitments } = await loadMemberTree(registry);
  const witness = membershipWitness(tree, commitments, secret);

  console.log(`   members       : ${commitments.length}`);
  console.log(`   rebuilt root  : ${hex(tree.root)}  (matches registry.root())`);
  console.log(`   our leaf      : index ${witness.leafIndex}`);

  if (hex(tree.root) !== hex(proposal.memberRoot)) {
    throw new Error(
      `The registry has moved on since proposal #${proposalId} opened.\n` +
        `This proposal is pinned to root ${hex(proposal.memberRoot)}.\n` +
        `Members who registered after it opened cannot vote on it.`,
    );
  }

  // ---------------------------------------------------------------------------
  step(3, "Compute the nullifier (offline)");
  // ---------------------------------------------------------------------------
  // keccak(2, secret, proposalId). Deterministic for this member on this
  // proposal, so a second vote is rejected; unlinkable to the commitment above,
  // so it does not say who the member is; different on every other proposal, so
  // votes cannot be joined across proposals into a voting history.
  const nullifier = nullifierFor(secret, proposalId);
  console.log(`   nullifier     : ${hex(nullifier)}`);

  // ---------------------------------------------------------------------------
  step(4, "Prove membership + intent (offline, ~2s)");
  // ---------------------------------------------------------------------------
  const startedAt = Date.now();
  const { proof, publicInputs } = generateVoteProof({
    root: tree.root,
    proposalId,
    nullifier,
    vote: VOTE,
    secret,
    path: witness.path,
    leafIndex: witness.leafIndex,
  });
  console.log(`   proved in     : ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`   proof size    : ${(proof.length - 2) / 2} bytes`);
  console.log(`   public inputs : root, proposalId, nullifier, vote`);
  console.log(`                   ${publicInputs.map((p) => p.slice(0, 10) + "…").join("  ")}`);
  console.log(`   private       : secret, Merkle path, leaf index — not in the proof`);

  // ---------------------------------------------------------------------------
  step(5, "Submit from a wallet that is not the member's");
  // ---------------------------------------------------------------------------
  // This is the step that actually buys anonymity. The proof is valid no matter
  // who sends it, so it is handed to a relayer. If the member broadcast this
  // from their own NFT-holding wallet, the sender address would name them and
  // the `support` argument sitting in calldata would name their vote.
  const relayer = relayerWallet(rpc);
  if ((await rpc.getBalance(relayer.address)) === 0n) {
    await rpc.send("anvil_setBalance", [relayer.address, "0xDE0B6B3A7640000"]);
  }

  const memberNonceBefore = await rpc.getTransactionCount(member.address);

  console.log(`   sender        : ${relayer.address}   (relayer — holds no NFT, never registered)`);
  console.log(`   member wallet : ${member.address}   (sends nothing, stays idle)`);

  const tx = await ballot.connect(relayer).castVote(proposalId, nullifier, Number(VOTE), proof);
  const receipt = await tx.wait();

  console.log(`   tx            : ${receipt.hash}`);
  console.log(`   gas used      : ${receipt.gasUsed}`);
  console.log(`   paid by       : ${receipt.from}`);

  const memberNonceAfter = await rpc.getTransactionCount(member.address);
  console.log(
    `\n   member wallet nonce: ${memberNonceBefore} before, ${memberNonceAfter} after — unchanged.` +
      `\n   The only transaction that wallet ever sent was its registration.`,
  );

  // ---------------------------------------------------------------------------
  const turnout = await ballot.turnout(proposalId);
  console.log(`\nTurnout so far : ${turnout} / ${proposal.anonymitySetSize} members`);
  try {
    const [yes, no] = await ballot.tally(proposalId);
    console.log(`Tally          : ${yes} yes / ${no} no`);
  } catch {
    console.log(`Tally          : sealed until the deadline (npm run tally)`);
  }

  console.log(`\nWhat the chain now shows: a nullifier nobody can trace to a member,`);
  console.log(`a vote paid for by ${relayer.address.slice(0, 10)}…, and a turnout counter.`);
  console.log(`Relayer balance: ${formatEther(await rpc.getBalance(relayer.address))} ETH`);
}

/** Turn a raw custom-error revert into something a member can act on. */
const REVERT_HELP = {
  AlreadyVoted:
    "This member has already voted on this proposal.\n" +
    "Their nullifier is spent -- which is exactly the double-vote protection working.\n" +
    "Note the contract still does not know WHICH member it just turned away.",
  InvalidProof: "The proof did not verify. Is the member root still the one this proposal pinned?",
  VotingClosed: "Voting has closed on this proposal.",
  NoSuchProposal: "No such proposal. Run: npm run propose",
  InvalidSupport: "SUPPORT must be yes or no.",
};

main().catch((err) => {
  const decoded = ballotErrorName(err) ?? err?.revert?.name;
  const help = REVERT_HELP[decoded];
  console.error("\n" + (help ?? err.message));
  process.exit(1);
});
