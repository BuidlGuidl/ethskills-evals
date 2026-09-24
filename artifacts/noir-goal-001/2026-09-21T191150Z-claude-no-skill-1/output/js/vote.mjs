#!/usr/bin/env node
// One member, one proposal: secret -> Merkle path -> nullifier -> ZK proof -> vote tx.
//
//   node js/vote.mjs --identity <file> --proposal <id> --vote yes|no
//        [--relayer http://host:port]          (default: $RELAYER_URL)
//   or, to submit yourself from an UNLINKED account:
//   SUBMITTER_PRIVATE_KEY=0x.. node js/vote.mjs --identity <file> --proposal <id> --vote yes --direct
//
// The member's NFT wallet key is never used or needed here.
import { parseArgs } from "node:util";
import { ethers } from "ethers";
import { connect, rpcUrl } from "./common/contracts.mjs";
import { loadIdentity } from "./common/identity.mjs";
import { MemberTree } from "./common/tree.mjs";
import { nullifierOf } from "./common/crypto.mjs";
import { proveVote } from "./common/prover.mjs";

/**
 * Rebuild the member tree exactly as it was when the proposal was created, from
 * public MemberRegistered events. Every member downloads the same full event
 * list, so the RPC endpoint learns nothing about which leaf is ours.
 */
async function snapshotTree(voting, deployment, proposal) {
  const logs = await voting.queryFilter(voting.filters.MemberRegistered(), deployment.deployBlock ?? 0);
  const leaves = logs
    .map((l) => ({ i: Number(l.args.leafIndex), c: l.args.commitment }))
    .sort((a, b) => a.i - b.i)
    .slice(0, Number(proposal.memberCount))
    .map((x) => x.c);
  const tree = new MemberTree(leaves);
  if (tree.root !== proposal.root) throw new Error("rebuilt member tree does not match proposal snapshot root");
  return tree;
}

/** Everything up to (not including) submission. Pure local computation plus public reads. */
export async function prepareVote({ provider, identityFile, proposalId, support }) {
  const { voting, deployment } = await connect(provider);
  const { secret, commitment } = loadIdentity(identityFile);

  const p = await voting.getProposal(proposalId);
  if (p.deadline === 0n) throw new Error(`proposal ${proposalId} does not exist`);
  const now = (await provider.getBlock("latest")).timestamp;
  if (BigInt(now) >= p.deadline) throw new Error(`proposal ${proposalId} is closed`);

  const tree = await snapshotTree(voting, deployment, p);
  const leafIndex = tree.indexOf(commitment);
  if (leafIndex < 0) {
    throw new Error("identity not in this proposal's member snapshot (not registered, or registered after it opened)");
  }
  const { siblings, indices } = tree.path(leafIndex);

  const scope = p.scope; // = keccak(chainid, contract, proposalId) mod p, read from chain
  const nullifier = nullifierOf(secret, scope);
  const vote = support ? 1n : 0n;

  const t0 = Date.now();
  const { proof, publicInputs } = await proveVote({ secret, siblings, indices, root: p.root, scope, vote, nullifier });
  const provingMs = Date.now() - t0;

  // Sanity: the circuit's public inputs are exactly what the contract will rebuild.
  const expected = [p.root, scope, vote, nullifier];
  if (publicInputs.length !== 4 || publicInputs.some((x, i) => BigInt(x) !== expected[i])) {
    throw new Error("public input mismatch between prover and contract layout");
  }

  // This is the only thing that leaves the member's machine.
  return {
    payload: {
      proposalId: proposalId.toString(),
      support,
      nullifier: nullifier.toString(),
      proof: ethers.hexlify(proof),
    },
    provingMs,
  };
}

export async function submitViaRelayer(relayerUrl, payload) {
  const res = await fetch(new URL("/vote", relayerUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`relayer rejected vote: ${body.error}`);
  return body.txHash;
}

export async function submitDirect(submitter, payload) {
  const { voting, nft } = await connect(submitter);
  if ((await nft.balanceOf(submitter.address)) > 0n) {
    throw new Error("refusing to submit from an address that holds a membership NFT");
  }
  const tx = await voting.castVote(payload.proposalId, payload.support, payload.nullifier, payload.proof);
  await tx.wait();
  return tx.hash;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      identity: { type: "string" },
      proposal: { type: "string" },
      vote: { type: "string" },
      relayer: { type: "string", default: process.env.RELAYER_URL },
      direct: { type: "boolean", default: false },
    },
  });
  if (!values.identity || !values.proposal || !["yes", "no"].includes(values.vote)) {
    console.error("usage: node js/vote.mjs --identity <file> --proposal <id> --vote yes|no [--relayer URL | --direct]");
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl());
  const { payload, provingMs } = await prepareVote({
    provider,
    identityFile: values.identity,
    proposalId: BigInt(values.proposal),
    support: values.vote === "yes",
  });
  console.log(`proof generated in ${provingMs} ms; nullifier ${payload.nullifier}`);

  let txHash;
  if (values.direct) {
    if (!process.env.SUBMITTER_PRIVATE_KEY) throw new Error("--direct needs SUBMITTER_PRIVATE_KEY (an unlinked account)");
    txHash = await submitDirect(new ethers.Wallet(process.env.SUBMITTER_PRIVATE_KEY, provider), payload);
  } else {
    if (!values.relayer) throw new Error("pass --relayer URL (or set RELAYER_URL), or use --direct");
    txHash = await submitViaRelayer(values.relayer, payload);
  }
  console.log(`vote submitted: ${txHash}`);
}
