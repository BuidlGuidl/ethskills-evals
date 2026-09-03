/**
 * Step 3 of the flow: one member, one secret, one anonymous ballot.
 *
 * Everything up to the last line happens on the member's own machine. The only
 * transaction is sent by a DIFFERENT wallet - the relayer - because a proof
 * that hides the voter is worthless if the voter's own address pays the gas.
 *
 *   node js/vote.js --proposal 1 --support yes
 *     [--member-key 0x..]   the member's wallet (only used offline, to derive
 *                           the secret and to locate their leaf)
 *     [--relayer-key 0x..]  the wallet that sends the transaction
 *     [--open]              let anyone submit the ballot instead of binding it
 *                           to the relayer's address
 */
import { toBeHex } from "ethers";
import { ANVIL_KEYS, connect, parseArgs } from "./core/chain.js";
import { commitmentFor, deriveSecret, nullifierFor, proposalScopeFor } from "./core/identity.js";
import { rootFromPath, treeMatchingRoot } from "./core/merkle.js";
import { generateVoteProof } from "./core/prove.js";

const hex = (value) => "0x" + BigInt(value).toString(16).padStart(64, "0");

const args = parseArgs();
const { ballot, deployment, provider, registry, wallet } = await connect();

const proposalId = BigInt(args.proposal ?? 1);
const support = String(args.support ?? "yes").toLowerCase() === "yes";
const member = wallet(args["member-key"] ?? process.env.MEMBER_KEY ?? ANVIL_KEYS[1]);
const relayer = wallet(args["relayer-key"] ?? process.env.RELAYER_KEY ?? ANVIL_KEYS[9]);

if (member.address === relayer.address) {
  throw new Error("the relayer must not be the member's own wallet - that would deanonymise the ballot");
}

// ---------------------------------------------------------------- offline --
// 1. The secret. Derived from a signature the member never publishes, so
//    there is nothing to store and nothing on-chain to link it to.
const secret = args.secret ? BigInt(args.secret) : await deriveSecret(member);
const commitment = commitmentFor(secret);

// 2. Locate our leaf in the public list, and rebuild the exact tree the
//    proposal was snapshotted against. We download every leaf, not just ours:
//    asking anyone for "my" path would give away which leaf is ours.
const [, membershipRoot, votingEnds, electorate] = await ballot.proposalInfo(proposalId);
const commitments = (await registry.getCommitments()).map(BigInt);
const leafIndex = commitments.indexOf(commitment);
if (leafIndex < 0) throw new Error("this secret has no leaf in the registry - run js/register.js first");

const { tree, snapshotSize } = treeMatchingRoot(commitments, membershipRoot);
if (leafIndex >= snapshotSize) throw new Error("this member joined after the proposal was created");
const { siblings } = tree.proofFor(leafIndex);
if (rootFromPath(commitment, leafIndex, siblings) !== BigInt(membershipRoot)) throw new Error("bad Merkle path");

// 3. The nullifier: deterministic per (secret, proposal, contract, chain),
//    and it reveals nothing about the leaf it came from.
const { chainId } = await provider.getNetwork();
const scope = proposalScopeFor(deployment.ballot, chainId, proposalId);
if (BigInt(await ballot.proposalScope(proposalId)) !== scope) throw new Error("scope mismatch with the contract");
const nullifier = nullifierFor(secret, scope);
if (await ballot.nullifierSpent(proposalId, nullifier)) throw new Error("this member has already voted on this proposal");

console.log("member wallet   ", member.address, "-> sends no transaction at all");
console.log("commitment      ", hex(commitment), `(leaf ${leafIndex} of ${snapshotSize})`);
console.log("proposal        ", proposalId.toString(), "closes", new Date(Number(votingEnds) * 1000).toISOString());
console.log("anonymity set   ", electorate.toString(), "members");
console.log("ballot          ", support ? "YES" : "NO");
console.log("nullifier       ", hex(nullifier));

// 4. The proof. Public inputs: root, proposal scope, nullifier, support,
//    submitter. Private witness: the secret, the leaf index, the path.
const submitter = args.open ? "0x0000000000000000000000000000000000000000" : relayer.address;
console.log("\nproving (membership + nullifier + ballot binding)...");
const startedAt = Date.now();
const { proof } = await generateVoteProof({
  membershipRoot,
  proposalScope: scope,
  nullifier,
  support,
  submitter,
  secret,
  leafIndex,
  siblings,
});
console.log(`proof ready in ${((Date.now() - startedAt) / 1000).toFixed(1)}s, ${(proof.length - 2) / 2} bytes`);

// ------------------------------------------------------------------ onchain --
// 5. Hand it to the relayer. In production this is an HTTP POST to a relayer,
//    or a gossip channel any member can pick the ballot up from; here the
//    relayer is simply a second local wallet.
const tx = await ballot.connect(relayer).castVote(proposalId, nullifier, support, submitter, proof);
const receipt = await tx.wait();

console.log("\ntx 3  castVote()");
console.log("  from        ", relayer.address, "(the relayer - NOT the member)");
console.log("  hash        ", receipt.hash);
console.log("  gas used    ", receipt.gasUsed.toString());
console.log("  calldata    ", `proposal ${proposalId}, nullifier ${hex(nullifier)}, support ${support}, proof`);
console.log("\nobserver learns: somebody in the snapshot of", electorate.toString(), "members voted", support ? "yes" : "no", "- and nothing else.");
console.log("                the nullifier is a fresh value for this proposal; it matches no leaf, no wallet,");
console.log("                and no nullifier this member published on any other proposal.");
