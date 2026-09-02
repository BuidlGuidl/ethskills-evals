#!/usr/bin/env node
/**
 * STEP 2 — a member opens a proposal.
 *
 *   node scripts/propose.mjs "Fund the grants program with 40 ETH" [votingPeriodSeconds]
 *
 * Sent from a member's own wallet. Who proposes is public and unavoidable; only
 * how people vote needs hiding.
 *
 * The important line here is that `createProposal` pins the registry root as it
 * stands right now. Every ballot on this proposal proves against that one root,
 * so the root reveals nothing about when the voter joined. The cost is that
 * members who join later are not eligible for this proposal — which is also the
 * behaviour you want, since it stops someone minting their way into a vote that
 * is already running.
 */
import { keccak256, toUtf8Bytes } from "ethers";
import { contracts, walletAt } from "./client/env.mjs";
import { toHex32 } from "./client/poseidon.mjs";

const text = process.argv[2] ?? "Fund the grants program with 40 ETH";
const votingPeriod = BigInt(process.argv[3] ?? 3600);
const proposerIndex = Number(process.env.PROPOSER_INDEX ?? 1);

const wallet = walletAt(proposerIndex);
const { ballot, registry } = contracts(wallet);

const descriptionHash = keccak256(toUtf8Bytes(text));
console.log(`proposer      : ${wallet.address}`);
console.log(`text          : ${text}`);
console.log(`descriptionHash: ${descriptionHash}   (the text itself lives offchain)`);
console.log(`registry root : ${toHex32(await registry.root())} over ${await registry.leafCount()} members`);

const tx = await ballot.createProposal(descriptionHash, votingPeriod);
const receipt = await tx.wait();
const created = receipt.logs
  .map((l) => {
    try {
      return ballot.interface.parseLog(l);
    } catch {
      return null;
    }
  })
  .find((e) => e?.name === "ProposalCreated");

console.log(`tx            : ${receipt.hash}`);
console.log(`proposal id   : ${created.args.proposalId}`);
console.log(`snapshot root : ${toHex32(created.args.snapshotRoot)}`);
console.log(`anonymity set : ${created.args.eligibleMembers} members`);
console.log(`deadline      : ${new Date(Number(created.args.deadline) * 1000).toISOString()}`);
