import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import { ethers } from "ethers";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend, Barretenberg } from "@aztec/bb.js";
import {
  TREE_DEPTH,
  commitment,
  merkleProof,
  nullifierHash,
  randomField,
  toHex32,
} from "./poseidonTree.js";

globalThis.crypto ??= crypto.webcrypto;

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const OWNER_KEY = process.env.OWNER_KEY;
const MEMBER_KEY = process.env.MEMBER_KEY;
const RELAYER_KEY = process.env.RELAYER_KEY;
const MEMBERSHIP_ADDRESS = process.env.MEMBERSHIP_ADDRESS;
const VOTING_ADDRESS = process.env.VOTING_ADDRESS;
const PROPOSAL_ID = BigInt(process.env.PROPOSAL_ID ?? "1");
const VOTE = BigInt(process.env.VOTE ?? "1");

if (!MEMBER_KEY || !RELAYER_KEY || !MEMBERSHIP_ADDRESS || !VOTING_ADDRESS) {
  throw new Error("Set MEMBER_KEY, RELAYER_KEY, MEMBERSHIP_ADDRESS, and VOTING_ADDRESS");
}
if (VOTE !== 0n && VOTE !== 1n) {
  throw new Error("VOTE must be 0 or 1");
}

const membershipAbi = [
  "function mint(address to) external returns (uint256)",
  "function balanceOf(address holder) external view returns (uint256)",
];
const votingAbi = [
  "event CommitmentInserted(address indexed memberWallet, uint256 indexed leafIndex, uint256 commitment, uint256 root)",
  "function join(uint256 commitment) external returns (uint256 leafIndex, uint256 newRoot)",
  "function createProposal(uint256 proposalId, uint64 deadline) external",
  "function castVote(uint256 proposalId, uint256 root, uint256 nullifierHash, uint8 vote, bytes proof) external",
  "function proposals(uint256 proposalId) external view returns (uint64 deadline, uint128 yes, uint128 no, bool exists)",
  "function tally(uint256 proposalId) external view returns (uint128 yes, uint128 no, bool final_)",
];

function fieldString(value) {
  return BigInt(value).toString();
}

async function freshNonce(provider, address) {
  return Number(await provider.send("eth_getTransactionCount", [address, "pending"]));
}

async function ensureProposal(voting, ownerWallet, provider) {
  const proposal = await voting.proposals(PROPOSAL_ID);
  if (proposal.exists) return;
  if (!ownerWallet) {
    throw new Error(`proposal ${PROPOSAL_ID} does not exist; set OWNER_KEY so the script can create it`);
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const tx = await voting.connect(ownerWallet).createProposal(PROPOSAL_ID, deadline, {
    nonce: await freshNonce(provider, ownerWallet.address),
  });
  await tx.wait();
  console.log(`created proposal ${PROPOSAL_ID} with deadline ${deadline}`);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const owner = OWNER_KEY ? new ethers.Wallet(OWNER_KEY, provider) : null;
  const member = new ethers.Wallet(MEMBER_KEY, provider);
  const relayer = new ethers.Wallet(RELAYER_KEY, provider);

  const membership = new ethers.Contract(MEMBERSHIP_ADDRESS, membershipAbi, member);
  const voting = new ethers.Contract(VOTING_ADDRESS, votingAbi, member);

  if ((await membership.balanceOf(member.address)) === 0n) {
    if (!owner) {
      throw new Error("member has no membership NFT; set OWNER_KEY so the script can mint one");
    }
    const mintTx = await membership.connect(owner).mint(member.address, {
      nonce: await freshNonce(provider, owner.address),
    });
    await mintTx.wait();
    console.log(`minted membership NFT to ${member.address}`);
  }
  await ensureProposal(voting, owner, provider);

  const nullifier = randomField();
  const secret = randomField();
  const leaf = commitment(nullifier, secret);

  const joinTx = await voting.connect(member).join(leaf);
  const joinReceipt = await joinTx.wait();
  console.log(`member joined with commitment ${leaf} in tx ${joinReceipt.hash}`);

  const logs = await voting.queryFilter(voting.filters.CommitmentInserted(), 0, "latest");
  const leaves = [];
  let leafIndex = null;
  for (const log of logs) {
    leaves[Number(log.args.leafIndex)] = BigInt(log.args.commitment);
    if (BigInt(log.args.commitment) === leaf) {
      leafIndex = Number(log.args.leafIndex);
    }
  }
  if (leafIndex === null) {
    throw new Error("could not find joined commitment in events");
  }

  const { root, pathElements, pathIndices } = merkleProof(leaves, leafIndex, TREE_DEPTH);
  const scopedNullifierHash = nullifierHash(nullifier, PROPOSAL_ID);

  const circuit = JSON.parse(await readFile(new URL("../circuits/vote/target/anonymous_vote.json", import.meta.url)));
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, await Barretenberg.new());

  const input = {
    nullifier: fieldString(nullifier),
    secret: fieldString(secret),
    path_elements: pathElements.map(fieldString),
    path_indices: pathIndices,
    root: fieldString(root),
    proposal_id: fieldString(PROPOSAL_ID),
    nullifier_hash: fieldString(scopedNullifierHash),
    vote: fieldString(VOTE),
  };

  const { witness } = await noir.execute(input);
  const { proof } = await backend.generateProof(witness, { verifierTarget: "evm" });

  const voteTx = await voting.connect(relayer).castVote(
    PROPOSAL_ID,
    root,
    scopedNullifierHash,
    Number(VOTE),
    ethers.hexlify(proof),
  );
  const voteReceipt = await voteTx.wait();
  console.log(`relayer submitted vote tx ${voteReceipt.hash}`);
  console.log(`public root=${toHex32(root)} nullifierHash=${toHex32(scopedNullifierHash)} vote=${VOTE}`);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
