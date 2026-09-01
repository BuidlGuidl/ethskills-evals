#!/usr/bin/env node
/**
 * One member, one secret, one anonymous ballot.
 *
 * Everything up to and including proof generation happens on the member's own
 * machine and touches the chain read-only. The only thing that goes out is the
 * transaction in step 7, and it is sent by a wallet that is not the member's.
 *
 *   node js/vote.js --proposal 0 --support yes --passphrase "..." --relayer-key 0x...
 *   node js/vote.js --proposal 0 --support no  --secret 0x...     --print-calldata
 *
 * `--print-calldata` stops before sending and prints a transaction anyone can
 * broadcast. That is the intended production shape: the member proves, someone else
 * pays and sends, and the someone else learns nothing beyond the ballot itself.
 */
import { formatEther } from "ethers";
import { Identity, voteScope } from "./core/identity.js";
import { connect, wallet, readMemberLeaves, DEFAULT_RPC } from "./core/chain.js";
import { buildTree, merkleProof, rootFromProof, TREE_DEPTH } from "./core/tree.js";
import { toHex32 } from "./core/hash.js";
import { proveBallot, expectedPublicInputs, shutdownProver } from "./core/prover.js";
import { parseArgs, step, info, warn, fail, resolveIdentity } from "./core/cli.js";

async function main() {
  const args = parseArgs();
  const proposalId = BigInt(args.proposal ?? process.env.PROPOSAL_ID ?? 0);

  const supportArg = String(args.support ?? process.env.SUPPORT ?? "").toLowerCase();
  if (!["yes", "no", "true", "false", "1", "0"].includes(supportArg)) {
    fail("pass --support yes|no");
  }
  const support = ["yes", "true", "1"].includes(supportArg);

  const { provider, registry, ballot, deployment } = await connect({ rpcUrl: args.rpc ?? DEFAULT_RPC });

  // ---------------------------------------------------------------- 1. secret
  step(1, "Load the member's secret (never leaves this machine)");
  const identity = await resolveIdentity(args, { Identity });
  if (!identity) fail("pass --secret 0x... or --passphrase '...' (or set MEMBER_SECRET/MEMBER_PASSPHRASE)");
  info("commitment H(secret)", toHex32(identity.commitment));

  // ------------------------------------------------------- 2. proposal + scope
  step(2, "Read the proposal");
  const proposal = await ballot.getProposal(proposalId);
  const deadline = Number(proposal.votingEnds);
  const now = (await provider.getBlock("latest")).timestamp;
  info("description", proposal.description);
  info("pinned tree root", proposal.root);
  info("anonymity set", `${proposal.eligible} registered members`);
  info("voting ends", `${new Date(deadline * 1000).toISOString()} (chain now ${new Date(now * 1000).toISOString()})`);
  if (now >= deadline) fail("voting has already closed for this proposal");
  if (Number(proposal.eligible) < 2) {
    warn("the anonymity set is smaller than 2 - a ballot here is effectively attributable");
  }

  const scope = voteScope(deployment.privateBallot, proposalId);
  const onchainScope = await ballot.voteScope(proposalId);
  if (toHex32(scope) !== onchainScope) fail("local voteScope disagrees with the contract");

  // ------------------------------------------------ 3. rebuild the member tree
  step(3, "Rebuild the member tree from onchain registrations");
  const leaves = await readMemberLeaves(registry);
  info("leaves read from events", leaves.length);
  const tree = buildTree(leaves);
  info("recomputed root", toHex32(tree.root));

  // Do not trust registry.root(): recomputing it from the individual registration
  // events is what proves the anonymity set is every real member, and not a set
  // padded with commitments an operator controls and can later subtract out.
  if (toHex32(tree.root) !== proposal.root) {
    fail(
      "recomputed root does not match the root this proposal was pinned to - " +
        "do not vote until this is explained",
    );
  }
  info("matches proposal root", "yes");

  const leafIndex = leaves.findIndex((leaf) => leaf === identity.commitment);
  if (leafIndex < 0) fail("this secret's commitment is not in the member tree - register first");
  const { siblings, pathBits } = merkleProof(tree, leafIndex);
  if (rootFromProof(identity.commitment, pathBits, siblings) !== tree.root) {
    fail("merkle path self-check failed");
  }
  info("leaf index (stays private)", `${leafIndex} of ${leaves.length}`);
  info("path depth", TREE_DEPTH);

  // ------------------------------------------------------------ 4. nullifier
  step(4, "Derive the nullifier for this proposal");
  const nullifier = identity.nullifier(scope);
  info("vote scope", toHex32(scope));
  info("nullifier H(secret,scope)", toHex32(nullifier));
  if (await ballot.nullifierSpent(proposalId, toHex32(nullifier))) {
    fail("this member has already voted on this proposal");
  }

  // ------------------------------------------------------------- 5. submitter
  step(5, "Choose the wallet that will submit the ballot");
  const relayerKey = args["relayer-key"] ?? process.env.RELAYER_PK;
  const printOnly = Boolean(args["print-calldata"]) || !relayerKey || relayerKey === true;

  let relayerAddress = args.relayer ?? process.env.RELAYER_ADDRESS;
  let relayer = null;
  if (relayerKey && relayerKey !== true) {
    relayer = wallet(relayerKey, provider);
    relayerAddress = relayer.address;
  }
  if (!relayerAddress) {
    fail("pass --relayer-key 0x... to send, or --relayer 0x<address> with --print-calldata");
  }
  info("submitting address", relayerAddress);
  warn("this address must NOT be the member's own wallet, and must not have been funded");
  warn("from it either - the funding transaction would re-link the ballot to the member.");
  if (relayer) {
    const balance = await provider.getBalance(relayer.address);
    info("submitter balance", `${formatEther(balance)} ETH`);
    if (balance === 0n) fail("the submitting wallet has no gas");
  }

  // ----------------------------------------------------------------- 6. prove
  step(6, "Generate the zero-knowledge proof (local, ~seconds)");
  const started = Date.now();
  const { proof, publicInputs } = await proveBallot({
    root: tree.root,
    scope,
    nullifier,
    support,
    relayer: relayerAddress,
    secret: identity.secret,
    pathBits,
    siblings,
  });
  info("proving time", `${((Date.now() - started) / 1000).toFixed(1)}s`);
  info("proof size", `${(proof.length - 2) / 2} bytes`);

  const expected = expectedPublicInputs({
    root: tree.root,
    scope,
    nullifier,
    support,
    relayer: relayerAddress,
  });
  const got = publicInputs.map((x) => toHex32(x));
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    fail(`public input mismatch\n  expected ${expected}\n  got      ${got}`);
  }
  info("public inputs", "root, scope, nullifier, vote, submitter");
  info("private and absent", "secret, leaf index, merkle path, commitment");

  // ------------------------------------------------------------------ 7. send
  const calldata = ballot.interface.encodeFunctionData("castVote", [
    proposalId,
    support,
    toHex32(nullifier),
    proof,
  ]);

  if (printOnly) {
    step(7, "Ballot ready - hand this to whoever will broadcast it");
    console.log(
      JSON.stringify({ to: deployment.privateBallot, from: relayerAddress, data: calldata }, null, 2),
    );
    console.log(
      "\nOnly `" + relayerAddress + "` can broadcast this: the submitter address is a public\n" +
        "input of the proof, so nobody can lift it from the mempool and re-target it.\n",
    );
    return;
  }

  step(7, "Submit the ballot");
  const tx = await ballot.connect(relayer).castVote(proposalId, support, toHex32(nullifier), proof);
  const receipt = await tx.wait();
  info("tx hash", receipt.hash);
  info("sent by", relayer.address);
  info("gas used", receipt.gasUsed.toString());
  info("vote recorded", support ? "yes" : "no");

  console.log(
    "\nWhat a chain observer learns from this transaction: that one of the " +
      proposal.eligible +
      "\nregistered members voted " +
      (support ? "yes" : "no") +
      ", and that this nullifier is now spent. Which member,\nit cannot tell - and neither can the DAO.\n",
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
