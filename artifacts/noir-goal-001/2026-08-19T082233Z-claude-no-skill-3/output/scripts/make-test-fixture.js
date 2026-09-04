/**
 * Generates test/fixtures/ballot.json: one real ballot (Merkle path + Honk
 * proof) that test/PrivateBallot.t.sol replays against the real verifier.
 *
 * Regenerate after any change to the circuit:
 *   (cd circuits/vote && nargo compile) && node scripts/make-test-fixture.js
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getCreateAddress, toBeHex } from "ethers";
import { commitmentFor, nullifierFor, proposalScopeFor } from "../js/core/identity.js";
import { buildTree } from "../js/core/merkle.js";
import { generateVoteProof } from "../js/core/prove.js";

const MEMBER_SECRET = 0x0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1n;
const OTHER_SECRETS = [1n, 2n, 3n, 4n, 5n];
const LEAF_INDEX = 2; // our member is the third to join
const PROPOSAL_ID = 1n;
// The Solidity test deploys PrivateBallot from 0x..dEa7 with nonce 0 on chain
// 31337, so the nullifier's scope is known ahead of time. The test asserts
// this matches, so a drift here fails loudly instead of silently.
const BALLOT_DEPLOYER = "0x000000000000000000000000000000000000dEa7";
const CHAIN_ID = 31337n;
const BALLOT_ADDRESS = getCreateAddress({ from: BALLOT_DEPLOYER, nonce: 0 });
const SUPPORT = true;
// anvil account #9, the relayer in the Solidity test
const SUBMITTER = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720";

const commitments = OTHER_SECRETS.map(commitmentFor);
commitments.splice(LEAF_INDEX, 0, commitmentFor(MEMBER_SECRET));

const tree = buildTree(commitments);
const { siblings } = tree.proofFor(LEAF_INDEX);
const scope = proposalScopeFor(BALLOT_ADDRESS, CHAIN_ID, PROPOSAL_ID);
const nullifier = nullifierFor(MEMBER_SECRET, scope);

console.log("ballot    ", BALLOT_ADDRESS);
console.log("root      ", toBeHex(tree.root, 32));
console.log("nullifier ", toBeHex(nullifier, 32));
console.log("proving...");

const { proof } = await generateVoteProof({
  membershipRoot: tree.root,
  proposalScope: scope,
  nullifier,
  support: SUPPORT,
  submitter: SUBMITTER,
  secret: MEMBER_SECRET,
  leafIndex: LEAF_INDEX,
  siblings,
});

mkdirSync("test/fixtures", { recursive: true });
writeFileSync(
  "test/fixtures/ballot.json",
  JSON.stringify(
    {
      commitments: commitments.map((c) => toBeHex(c, 32)),
      leafIndex: LEAF_INDEX,
      root: toBeHex(tree.root, 32),
      proposalId: Number(PROPOSAL_ID),
      ballotDeployer: BALLOT_DEPLOYER,
      ballotAddress: BALLOT_ADDRESS,
      chainId: Number(CHAIN_ID),
      proposalScope: toBeHex(scope, 32),
      nullifier: toBeHex(nullifier, 32),
      support: SUPPORT,
      submitter: SUBMITTER,
      proof,
    },
    null,
    2,
  ) + "\n",
);
console.log("wrote test/fixtures/ballot.json  (proof bytes:", (proof.length - 2) / 2, ")");
