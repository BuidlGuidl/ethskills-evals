// Step 2 (per proposal): from the member's secret to a submitted, unattributable vote.
//
//   1. load the identity secret (IDENTITY_SECRET, or re-derived by signing locally with
//      MEMBER_PRIVATE_KEY - an offchain signature, no transaction);
//   2. read the proposal's snapshot root and rebuild the registry tree from ALL LeafSet
//      events, locating our leaf locally;
//   3. compute the nullifier and generate the ZK proof locally;
//   4. hand {proposalId, support, nullifier, proof} to a relayer, which sends castVote.
//      The member's NFT wallet never sends, signs or funds the vote transaction.
//
//   MEMBER_PRIVATE_KEY=0x.. PROPOSAL_ID=1 SUPPORT=yes RELAYER_URL=http://127.0.0.1:8787 node scripts/vote.mjs
//   (or RELAYER_PRIVATE_KEY=0x.. instead of RELAYER_URL to send directly from an
//    unlinked wallet you control - it must never have been funded from your member wallet)
import { ethers } from "ethers";
import { connect, env, loadSecret, commitmentOf, snapshotTree, merklePath, proveVote } from "./lib.mjs";

const ctx = await connect();
const proposalId = BigInt(env("PROPOSAL_ID"));
const support = { yes: true, no: false }[env("SUPPORT").toLowerCase()];
if (support === undefined) throw new Error("SUPPORT must be yes or no");

// 1. secret
const memberWallet = process.env.MEMBER_PRIVATE_KEY ? new ethers.Wallet(process.env.MEMBER_PRIVATE_KEY) : undefined;
const secret = await loadSecret({ dep: ctx.dep, memberWallet });
const commitment = commitmentOf(secret);

// 2. proposal snapshot + our Merkle path
const p = await ctx.voting.proposals(proposalId);
if (p.deadline === 0n) throw new Error(`proposal ${proposalId} does not exist`);
const now = (await ctx.provider.getBlock("latest")).timestamp;
if (BigInt(now) >= p.deadline) throw new Error("voting has closed");
const tree = await snapshotTree(ctx, proposalId);
const path = merklePath(tree, commitment);
if (!path) throw new Error("your commitment is not in this proposal's snapshot (registered after it opened?)");
const scope = await ctx.voting.scopeOf(proposalId);
console.log(`proposal ${proposalId}: electorate ${p.electorate} - your vote hides among them`);

// 3. proof (local)
const t0 = Date.now();
const { nullifier, proof } = await proveVote({ secret, index: path.index, siblings: path.siblings, root: tree.root, scope, support });
console.log(`proof generated in ${((Date.now() - t0) / 1000).toFixed(1)}s (${(proof.length - 2) / 2} bytes)`);

// 4. submit through a relayer
const payload = { proposalId: proposalId.toString(), support, nullifier: nullifier.toString(), proof };
let txHash;
if (process.env.RELAYER_URL) {
  const res = await fetch(new URL("/vote", process.env.RELAYER_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(`relayer rejected vote: ${out.error}`);
  txHash = out.txHash;
} else {
  const relayer = new ethers.Wallet(env("RELAYER_PRIVATE_KEY"), ctx.provider);
  if (memberWallet && relayer.address === memberWallet.address) {
    throw new Error("refusing to send the vote from your member wallet: that would attribute it to you");
  }
  if ((await ctx.nft.balanceOf(relayer.address)) > 0n) {
    throw new Error("refusing: the sending wallet holds a membership NFT, which would attribute the vote");
  }
  const tx = await ctx.voting.connect(relayer).castVote(proposalId, support, nullifier, proof);
  txHash = (await tx.wait()).hash;
}
console.log(`vote submitted: ${support ? "yes" : "no"}, tx ${txHash}`);
console.log(`nullifier ${ethers.toBeHex(nullifier, 32)} (never share it: nullifier + onchain VoteCast = your vote)`);
