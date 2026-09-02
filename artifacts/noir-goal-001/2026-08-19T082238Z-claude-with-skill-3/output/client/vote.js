#!/usr/bin/env node
// STEP 2 of 2 for a member: secret -> proof -> submitted vote.
//
//   node client/vote.js --proposal 0 --support yes --note client/notes/member-42.json
//
// Everything up to `castVote` happens on the member's machine. The only thing that
// leaves it is (proof, nullifierHash, support) -- and those go to a RELAYER, which
// sends the transaction from an unrelated address. The member's wallet does not
// appear anywhere in this step; if it did, `msg.sender` would re-link them to their
// ballot and the zero-knowledge proof would have bought nothing.

import { getContract } from "viem";
import { args } from "./src/args.js";
import { loadNote, nullifierHash } from "./src/identity.js";
import { treeFromEvents } from "./src/tree.js";
import { proveVote, shutdownProver } from "./src/prove.js";
import {
  abiOf,
  loadDeployment,
  publicClient,
  walletFor,
  relayerAccount,
  waitFor,
} from "./src/chain.js";

export async function vote({ proposalId, support, note, deployment, relayer, log = () => {} }) {
  const pub = publicClient();
  const registryAbi = abiOf("MemberRegistry");
  const ballotAbi = abiOf("AnonymousBallot");

  const ballot = getContract({
    address: deployment.ballot,
    abi: ballotAbi,
    client: { public: pub },
  });

  // --- 1. read the proposal's frozen snapshot -------------------------------------
  const [, merkleRoot, snapshotMemberCount, votingEnds] = await ballot.read.proposals([
    BigInt(proposalId),
  ]);
  log(`proposal ${proposalId}: anonymity set ${snapshotMemberCount}, closes at ${votingEnds}`);

  // --- 2. rebuild the member tree from events, offchain ----------------------------
  // Not a contract call that returns a path: asking the chain "what is the path for
  // leaf 42?" would tell whoever answers which leaf is ours.
  const events = await pub.getContractEvents({
    address: deployment.registry,
    abi: registryAbi,
    eventName: "MemberRegistered",
    fromBlock: 0n,
    toBlock: "latest",
  });
  const tree = await treeFromEvents(
    events.map((e) => ({ commitment: e.args.commitment, leafIndex: e.args.leafIndex })),
    Number(snapshotMemberCount),
  );

  if (tree.root !== merkleRoot) {
    throw new Error(
      `local mirror disagrees with the proposal snapshot:\n` +
        `  local 0x${tree.root.toString(16)}\n  chain 0x${merkleRoot.toString(16)}`,
    );
  }
  log(`rebuilt tree from ${tree.size} events, root matches the snapshot`);

  // --- 3. derive our own Merkle witness --------------------------------------------
  const leafIndex = tree.indexOf(note.commitment);
  if (leafIndex < 0) {
    throw new Error("this commitment was not in the tree when the proposal opened");
  }
  const { siblings, pathIndices } = tree.proof(leafIndex);

  // --- 4. the spend marker, scoped to this proposal --------------------------------
  const nullifier = await nullifierHash(note.secret, proposalId);
  if (await ballot.read.nullifierSpent([BigInt(proposalId), nullifier])) {
    throw new Error("already voted on this proposal");
  }

  // --- 5. prove, in-process ---------------------------------------------------------
  const t0 = Date.now();
  const { proof } = await proveVote({
    root: merkleRoot,
    proposalId,
    nullifierHash: nullifier,
    support,
    secret: note.secret,
    trapdoor: note.trapdoor,
    siblings,
    pathIndices,
  });
  log(`proved in ${Date.now() - t0}ms (${(proof.length - 2) / 2} bytes)`);

  // --- 6. hand it to the relayer ----------------------------------------------------
  // In production this is an HTTP POST to a relayer or a 4337 bundler. The payload is
  // exactly these four values; the relayer learns the vote but not the voter, and
  // cannot alter the vote -- `support` is bound into the proof.
  const relayerWallet = walletFor(relayer);
  const hash = await relayerWallet.writeContract({
    address: deployment.ballot,
    abi: ballotAbi,
    functionName: "castVote",
    args: [BigInt(proposalId), nullifier, support, proof],
  });
  const receipt = await waitFor(hash, pub);

  return { hash, nullifier, proof, support, relayer: relayer.address, gasUsed: receipt.gasUsed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  const deployment = loadDeployment();
  const notePath = a.note ?? "client/notes/member-0.json";
  const note = loadNote(notePath);
  if (!note) throw new Error(`no note at ${notePath} -- run client/register.js first`);

  const support = ["yes", "true", "1"].includes(String(a.support ?? "yes").toLowerCase());
  const proposalId = Number(a.proposal ?? 0);

  const r = await vote({
    proposalId,
    support,
    note,
    deployment,
    relayer: relayerAccount(),
    log: (m) => console.log("  " + m),
  });

  console.log(`voted ${support ? "YES" : "NO"} on proposal ${proposalId}`);
  console.log(`  sent by       ${r.relayer}   <- the relayer, NOT the member`);
  console.log(`  nullifier     0x${r.nullifier.toString(16)}`);
  console.log(`  tx            ${r.hash} (gas ${r.gasUsed})`);
  await shutdownProver();
}
