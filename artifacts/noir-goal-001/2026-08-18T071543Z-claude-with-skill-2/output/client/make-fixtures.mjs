/**
 * Generate the fixtures used by the Solidity tests.
 *
 * Runs entirely offline: it builds the same member tree the test will build
 * onchain, then produces one real UltraHonk proof against it. The Solidity test
 * replays those commitments into the real MembershipRegistry and feeds the real
 * proof to the real HonkVerifier — so a mismatch anywhere in the chain
 * (poseidon-lite -> PoseidonT3 -> Noir hash_2, or circuit -> verifier) fails a
 * test instead of failing in production.
 *
 *   npm run fixtures
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon2 } from "poseidon-lite";
import { identityFromSeed, toBytes32 } from "./lib/identity.mjs";
import { proveVote } from "./lib/prover.mjs";

/** Mirrors AnonymousVoting.daoScopeSeed used in test/AnonymousVoting.t.sol. */
const DAO_SCOPE_SEED = keccak256(toUtf8Bytes("dao-anonymous-voting/test"));
const PROPOSAL_ID = 0n;
const MEMBER_COUNT = 5;
const VOTER_INDEX = 3;
const SUPPORT = true;

/** Mirrors AnonymousVoting.scopeOf. */
function scopeOf(seed, proposalId) {
  const encoded = AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [seed, proposalId]);
  return BigInt(keccak256(encoded)) >> 8n;
}

const identities = Array.from({ length: MEMBER_COUNT }, (_, i) =>
  identityFromSeed(`fixture-member-${i}`)
);

const tree = new LeanIMT((a, b) => poseidon2([a, b]));
for (const id of identities) tree.insert(id.commitment);

const scope = scopeOf(DAO_SCOPE_SEED, PROPOSAL_ID);
console.log(`members: ${MEMBER_COUNT}  depth: ${tree.depth}  root: ${toBytes32(tree.root)}`);
console.log("generating proof (10-30s)...");

const ballot = await proveVote({
  identity: identities[VOTER_INDEX],
  tree,
  leafIndex: VOTER_INDEX,
  scope,
  support: SUPPORT,
});

const outDir = fileURLToPath(new URL("../test/fixtures/", import.meta.url));
await mkdir(outDir, { recursive: true });
await writeFile(
  `${outDir}vote.json`,
  `${JSON.stringify(
    {
      // Sorted keys: forge's vm.parseJson is order sensitive when decoding to
      // a struct, so the test reads each field by name instead.
      commitments: identities.map((id) => toBytes32(id.commitment)),
      daoScopeSeed: DAO_SCOPE_SEED,
      nullifierHash: ballot.nullifierHash,
      proof: ballot.proofHex,
      proposalId: Number(PROPOSAL_ID),
      root: ballot.root,
      scope: toBytes32(scope),
      support: SUPPORT,
      voterIndex: VOTER_INDEX,
    },
    null,
    2
  )}\n`
);

// A second ballot from a different member, so the tests can check that two
// distinct members can both vote and that a nullifier is per-member.
const otherIndex = 1;
const other = await proveVote({
  identity: identities[otherIndex],
  tree,
  leafIndex: otherIndex,
  scope,
  support: false,
});
await writeFile(
  `${outDir}vote_second_member.json`,
  `${JSON.stringify(
    {
      nullifierHash: other.nullifierHash,
      proof: other.proofHex,
      support: false,
      voterIndex: otherIndex,
    },
    null,
    2
  )}\n`
);

// Poseidon parity anchor, cross-checked in Noir and in Solidity.
await writeFile(
  `${outDir}poseidon.json`,
  `${JSON.stringify({ hash_1_2: toBytes32(poseidon2([1n, 2n])) }, null, 2)}\n`
);

console.log(`wrote ${outDir}vote.json, vote_second_member.json, poseidon.json`);
