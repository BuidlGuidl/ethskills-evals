#!/usr/bin/env node
//
// Step 3 of the flow: one member goes from their secret to a submitted ballot.
//
//   node js/vote.js --member 7 --proposal 0 --support yes
//
// Everything up to `castVote` happens offline on the member's machine. The
// transaction itself is signed and paid for by a *relayer* wallet with no link
// to the member — that separation is what keeps the ballot anonymous, since
// the proof itself proves nothing about which member produced it.
import { ethers } from "ethers";
import { connect, fundLocally, loadSecret, memberWallet, relayerWallet } from "./core/chain.js";
import { commitment, nullifier } from "./core/identity.js";
import { hex32 } from "./core/poseidon.js";
import { proveCircuit } from "./core/prover.js";
import { buildTree } from "./core/tree.js";
import { parseArgs } from "./core/args.js";

/** Build the ballot proof. Pure local computation — no wallet, no network writes. */
export async function buildBallot({ chain, secret, proposalId, support }) {
  const { registry, ballot } = chain;

  const [root, memberCount, deadline] = await ballot.proposalInfo(proposalId);
  if (BigInt(deadline) * 1000n <= BigInt(Date.now())) {
    console.warn(`! proposal ${proposalId} closes at ${new Date(Number(deadline) * 1000).toISOString()}`);
  }

  // --- Rebuild the snapshot the proposal was opened against. The registry is
  //     append-only, so the first `memberCount` commitments *are* the snapshot.
  const leaves = (await registry.allCommitments()).slice(0, Number(memberCount)).map(BigInt);
  const tree = buildTree(leaves);

  // --- Refuse to vote against a root we cannot reproduce. This is the check
  //     that makes the anonymity set trustworthy: if the DAO could hand us a
  //     root containing only our own leaf, our ballot would be attributable.
  if (tree.root !== BigInt(root)) {
    throw new Error(
      `proposal root ${root} does not match the ${leaves.length} published commitments — refusing to vote`,
    );
  }
  if (leaves.length < 2) throw new Error(`anonymity set of ${leaves.length} is not an anonymity set`);

  const leaf = commitment(secret);
  const index = leaves.findIndex((l) => l === leaf);
  if (index === -1) throw new Error("this secret's commitment is not in the snapshot — did you join in time?");

  // --- The nullifier is bound to this chain, this Ballot and this proposal.
  const context = BigInt(await ballot.proposalContext(proposalId));
  const nullifierHash = nullifier(secret, context);
  if (await ballot.nullifierUsed(proposalId, hex32(nullifierHash))) {
    throw new Error("this member has already voted on this proposal");
  }

  const { proof, publicInputs } = proveCircuit("vote", {
    root: hex32(tree.root),
    proposal_context: hex32(context),
    vote: support ? "1" : "0",
    nullifier_hash: hex32(nullifierHash),
    secret: hex32(secret),
    index: String(index),
    siblings: tree.siblings(index).map(hex32),
  });

  // Sanity: the proof must be about exactly what the contract will check.
  const expected = [hex32(tree.root), hex32(context), hex32(support ? 1 : 0), hex32(nullifierHash)];
  if (publicInputs.join() !== expected.join()) {
    throw new Error(`public inputs disagree with the contract's view:\n  ${publicInputs}\n  ${expected}`);
  }

  return { proof, nullifier: hex32(nullifierHash), support, anonymitySet: leaves.length, leafIndex: index };
}

export async function vote({ memberIndex, proposalId, support, relayerIndex = 0, fund = false }) {
  const chain = await connect();
  const secret = loadSecret(chain.chainId, `member-${memberIndex}`);
  if (secret === null) throw new Error(`no secret for member ${memberIndex} — run js/join.js first`);

  const ballot = await buildBallot({ chain, secret, proposalId, support });

  // --- Hand the proof to a wallet that is not the member's. On a local chain
  //     we give it gas out of thin air; in production this is a relayer
  //     service or an ERC-4337 paymaster. Funding it *from* the member's
  //     wallet would re-link the two and undo everything above.
  const relayer = relayerWallet(relayerIndex, chain.provider);
  if (fund) await fundLocally(chain.provider, relayer.address, "10");

  const tx = await chain.ballot
    .connect(relayer)
    .castVote(proposalId, support, ballot.nullifier, ballot.proof);
  const receipt = await tx.wait();

  return {
    ...ballot,
    relayer: relayer.address,
    memberAddress: memberWallet(memberIndex, chain.provider).address,
    txHash: receipt.hash,
    gasUsed: receipt.gasUsed,
    proofBytes: ethers.dataLength(ballot.proof),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const support = String(args.support ?? "yes").toLowerCase();
  if (!["yes", "no", "true", "false"].includes(support)) throw new Error("--support must be yes or no");

  const result = await vote({
    memberIndex: Number(args.member ?? 0),
    proposalId: Number(args.proposal ?? 0),
    support: support === "yes" || support === "true",
    relayerIndex: Number(args.relayer ?? 0),
    fund: Boolean(args.fund),
  });

  console.log(`ballot cast on proposal ${args.proposal ?? 0}`);
  console.log(`  anonymity set : ${result.anonymitySet} members`);
  console.log(`  member wallet : ${result.memberAddress}  (never touches the chain here)`);
  console.log(`  sender        : ${result.relayer}  (relayer — pays gas, learns the vote, not the voter)`);
  console.log(`  nullifier     : ${result.nullifier}`);
  console.log(`  proof         : ${result.proofBytes} bytes`);
  console.log(`  tx            : ${result.txHash}  (gas ${result.gasUsed})`);
  console.log(`  leaf index    : ${result.leafIndex}  <- known only on this machine, never sent`);
}
