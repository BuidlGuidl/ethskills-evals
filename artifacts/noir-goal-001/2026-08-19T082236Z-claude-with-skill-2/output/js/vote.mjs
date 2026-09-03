// Step 3 of the flow: one member goes from their secret to a submitted ballot.
//
// This is the whole privacy story in one file. Read the two SENT BY comments below:
// everything here happens on the member's machine except the last transaction, which is
// sent by a wallet that has never been associated with any member.
//
// Usage: MEMBER_INDEX=7 PROPOSAL_ID=1 VOTE=yes node js/vote.mjs
import { contracts, memberWallet, relayerWallet, provider } from "./lib/chain.mjs";
import { loadNote, deriveNote } from "./lib/note.mjs";
import { buildTreeFromEvents, merkleWitness, resolveLeafIndex } from "./lib/tree.mjs";
import { nullifierHashOf } from "./lib/poseidon.mjs";
import { VoteProver, toHexProof } from "./lib/prove.mjs";

export async function castVote({
  memberIndex = Number(process.env.MEMBER_INDEX ?? 0),
  proposalId = BigInt(process.env.PROPOSAL_ID ?? 1),
  support = (process.env.VOTE ?? "yes").toLowerCase() !== "no",
  prover = null,
  quiet = false,
} = {}) {
  const log = quiet ? () => {} : (...a) => console.log(...a);

  // ---------------------------------------------------------------------------------
  // (a) The member, locally. No transaction, no key material leaves this process.
  //     SENT BY: nobody. These are reads and local computation.
  // ---------------------------------------------------------------------------------
  const member = memberWallet(memberIndex);
  const { voting, registry, deployment } = contracts(provider);

  const note = loadNote(member.address) ?? (await deriveNote(member));
  const proposal = await voting.getProposal(proposalId);

  // Mirror the voter tree as it stood when the proposal snapshotted it. Using "latest"
  // instead would silently produce a path to a newer root and every proof would fail.
  const [created] = await voting.queryFilter(voting.filters.ProposalCreated(proposalId), 0, "latest");
  if (!created) throw new Error(`proposal ${proposalId} not found onchain`);
  const tree = await buildTreeFromEvents(registry, created.blockNumber, deployment.deployBlock);

  if (tree.root !== proposal.root) {
    throw new Error(
      `offchain mirror root 0x${tree.root.toString(16)} != proposal root 0x${proposal.root.toString(16)}`,
    );
  }

  const leafIndex = resolveLeafIndex(tree, note.commitment, note.leafIndex);
  const witness = merkleWitness(tree, leafIndex);
  const nullifierHash = nullifierHashOf(note.nullifier, proposalId);
  const vote = support ? 1n : 0n;

  log(`member ${memberIndex} (${member.address})`);
  log(`  leafIndex        ${leafIndex} of ${proposal.electorateSize} in the electorate`);
  log(`  proposal root    0x${proposal.root.toString(16)}`);
  log(`  nullifierHash    0x${nullifierHash.toString(16)}   <- unique to (member, proposal)`);
  log(`  ballot           ${support ? "YES" : "NO"}`);

  // ---------------------------------------------------------------------------------
  // (b) Proving, in-process. In the real app this same module runs in the member's
  //     browser — a server-side prover would see the secret and know the vote.
  // ---------------------------------------------------------------------------------
  const ownProver = prover === null;
  const p = prover ?? (await VoteProver.create());
  let proofData;
  try {
    const started = Date.now();
    proofData = await p.prove({
      root: proposal.root,
      proposalId,
      nullifierHash,
      vote,
      secret: note.secret,
      nullifier: note.nullifier,
      pathElements: witness.pathElements,
      pathIndices: witness.pathIndices,
    });
    log(`  proof            ${proofData.proof.length} bytes in ${Date.now() - started} ms`);

    if (!(await p.verifyLocally(proofData))) {
      throw new Error("proof failed local verification — do not spend gas on it");
    }
  } finally {
    if (ownProver) await p.destroy();
  }

  // ---------------------------------------------------------------------------------
  // (c) Submission.
  //     SENT BY: the relayer. NOT the member.
  //     The proof is what authorises the ballot, so msg.sender is irrelevant to the
  //     contract — and that is exactly why it must not be the member's wallet. If the
  //     member sent this themselves, msg.sender would attribute the vote and every line
  //     above would be theatre. A burner funded from the member's wallet is no better:
  //     the funding transfer restores the link.
  // ---------------------------------------------------------------------------------
  const relayer = relayerWallet();
  const { voting: votingAsRelayer } = contracts(relayer);
  const tx = await votingAsRelayer.castVote(proposalId, nullifierHash, support, toHexProof(proofData.proof));
  const receipt = await tx.wait();

  log(`  castVote tx      ${receipt.hash}`);
  log(`  sent by          ${relayer.address}   <- the relayer, not the member`);
  log(`  gas used         ${receipt.gasUsed}`);

  return { receipt, nullifierHash, leafIndex, support };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  castVote().catch((e) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
}
