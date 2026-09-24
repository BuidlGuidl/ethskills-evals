import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { ethers } from "ethers";
import {
  TREE_DEPTH,
  commitmentFromNote,
  merkleProof,
  nullifierHashForProposal,
  randomField,
  toHex32,
} from "./fixedTree.js";

globalThis.crypto ??= crypto.webcrypto;

const require = createRequire(import.meta.url);
const membershipArtifact = require("../out/SimpleMembershipNFT.sol/SimpleMembershipNFT.json");
const voteArtifact = require("../out/PrivateVote.sol/PrivateVote.json");

const DEFAULT_OWNER = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEFAULT_MEMBER = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const DEFAULT_RELAYER = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

function usage() {
  console.log(`Usage:
  RPC_URL=http://127.0.0.1:8545 \\
  MEMBERSHIP_ADDRESS=0x... \\
  VOTE_ADDRESS=0x... \\
  node scripts/vote-one-member.mjs

Optional:
  OWNER_KEY    proposal creator; defaults to anvil account 0
  MEMBER_KEY   wallet that holds/mints the membership NFT; defaults to anvil account 1
  RELAYER_KEY  unlinkable sender for castVote; defaults to anvil account 2
  PROPOSAL_ID  existing proposal to use; if omitted, the script creates one
  VOTE         yes or no; defaults to yes`);
}

async function main() {
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const membershipAddress = process.env.MEMBERSHIP_ADDRESS;
  const voteAddress = process.env.VOTE_ADDRESS;
  if (!membershipAddress || !voteAddress) {
    usage();
    throw new Error("MEMBERSHIP_ADDRESS and VOTE_ADDRESS are required");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const owner = new ethers.Wallet(process.env.OWNER_KEY ?? DEFAULT_OWNER, provider);
  const member = new ethers.Wallet(process.env.MEMBER_KEY ?? DEFAULT_MEMBER, provider);
  const relayer = new ethers.Wallet(process.env.RELAYER_KEY ?? DEFAULT_RELAYER, provider);
  const membership = new ethers.Contract(membershipAddress, membershipArtifact.abi, member);
  const voteContractAsOwner = new ethers.Contract(voteAddress, voteArtifact.abi, owner);
  const voteContractAsMember = new ethers.Contract(voteAddress, voteArtifact.abi, member);
  const voteContractAsRelayer = new ethers.Contract(voteAddress, voteArtifact.abi, relayer);
  const ownerAddress = await owner.getAddress();
  const memberAddress = await member.getAddress();
  const relayerAddress = await relayer.getAddress();
  let ownerNonce = await provider.getTransactionCount(ownerAddress, "pending");
  let memberNonce = await provider.getTransactionCount(memberAddress, "pending");
  let relayerNonce = await provider.getTransactionCount(relayerAddress, "pending");

  if ((await membership.balanceOf(memberAddress)) === 0n) {
    const tx = await membership.mint(memberAddress, { nonce: memberNonce++ });
    await tx.wait();
    console.log(`minted membership NFT to ${memberAddress}`);
  }

  let proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : undefined;
  if (proposalId === undefined) {
    const now = BigInt((await provider.getBlock("latest")).timestamp);
    const tx = await voteContractAsOwner.createProposal(now + 600n, { nonce: ownerNonce++ });
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => {
        try {
          return voteContractAsOwner.interface.parseLog(log);
        } catch {
          return undefined;
        }
      })
      .find((parsed) => parsed?.name === "ProposalCreated");
    proposalId = event.args.proposalId;
    console.log(`created proposal ${proposalId}`);
  }

  const note = {
    secret: randomField(),
    nullifier: randomField(),
  };
  const commitment = commitmentFromNote(note.secret, note.nullifier);
  const joinTx = await voteContractAsMember.joinProposal(proposalId, toHex32(commitment), { nonce: memberNonce++ });
  const joinReceipt = await joinTx.wait();
  const joinEvent = joinReceipt.logs
    .map((log) => {
      try {
        return voteContractAsMember.interface.parseLog(log);
      } catch {
        return undefined;
      }
    })
    .find((parsed) => parsed?.name === "CommitmentInserted");
  const leafIndex = Number(joinEvent.args.leafIndex);
  console.log(`joined proposal ${proposalId} at leaf ${leafIndex}`);

  const filter = voteContractAsMember.filters.CommitmentInserted(proposalId);
  const events = await voteContractAsMember.queryFilter(filter, 0, "latest");
  const leaves = events.map((event) => BigInt(event.args.commitment));
  const proofPath = merkleProof(leaves, leafIndex, TREE_DEPTH);
  const root = BigInt(joinEvent.args.root);
  if (root !== proofPath.root) {
    throw new Error(`offchain root ${toHex32(proofPath.root)} does not match onchain root ${toHex32(root)}`);
  }

  const circuit = JSON.parse(await readFile("target/private_vote.json", "utf8"));
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, await Barretenberg.new());
  const support = (process.env.VOTE ?? "yes").toLowerCase() !== "no";
  const publicNullifierHash = nullifierHashForProposal(note.nullifier, proposalId);
  const input = {
    secret: note.secret.toString(),
    nullifier: note.nullifier.toString(),
    path_elements: proofPath.pathElements.map((x) => x.toString()),
    path_indices: proofPath.pathIndices,
    root: proofPath.root.toString(),
    nullifier_hash: publicNullifierHash.toString(),
    proposal_id: proposalId.toString(),
    vote: support ? "1" : "0",
  };
  const { witness } = await noir.execute(input);
  const zkProof = await backend.generateProof(witness, { verifierTarget: "evm" });

  const castTx = await voteContractAsRelayer.castVote(
    proposalId,
    support,
    toHex32(proofPath.root),
    toHex32(publicNullifierHash),
    zkProof.proof,
    { nonce: relayerNonce++ },
  );
  await castTx.wait();

  const deadline = (await voteContractAsMember.proposals(proposalId)).deadline;
  const latest = BigInt((await provider.getBlock("latest")).timestamp);
  if (latest < deadline) {
    await provider.send("evm_setNextBlockTimestamp", [Number(deadline)]);
    await provider.send("evm_mine", []);
  }

  const [yesVotes, noVotes] = await voteContractAsMember.tally(proposalId);
  console.log(`cast ${support ? "yes" : "no"} via relayer ${relayerAddress}`);
  console.log(`tally yes=${yesVotes} no=${noVotes}`);
  console.log(`save this note privately: ${JSON.stringify({ ...note, leafIndex }, (_, v) => typeof v === "bigint" ? v.toString() : v)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
