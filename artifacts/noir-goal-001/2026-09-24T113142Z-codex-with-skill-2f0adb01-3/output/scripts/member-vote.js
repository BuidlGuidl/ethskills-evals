import crypto from "node:crypto";
import fs from "node:fs";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { createPublicClient, createWalletClient, getContract, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { poseidon2, toFieldHex } from "./poseidon.js";
import { merkleProof } from "./fixedMerkleTree.js";

const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const deploymentPath = process.env.DEPLOYMENT ?? "deployments/local.json";
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
const rpcUrl = process.env.RPC_URL ?? deployment.rpcUrl ?? "http://127.0.0.1:8545";
const chain = {
  ...foundry,
  id: Number(deployment.chainId ?? 31337),
  rpcUrls: { default: { http: [rpcUrl] } },
};

const memberKey =
  process.env.MEMBER_PRIVATE_KEY ??
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const deployerKey =
  process.env.DEPLOYER_PRIVATE_KEY ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const relayerKey =
  process.env.RELAYER_PRIVATE_KEY ??
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba";

const membershipAbi = parseAbi(["function mint(address to) external returns (uint256)"]);
const governanceAbi = parseAbi([
  "function createProposal(uint256 proposalId,uint64 joinDeadline,uint64 voteDeadline) external",
  "function joinProposal(uint256 proposalId,bytes32 commitment) external returns (uint256)",
  "function castVote(uint256 proposalId,bytes proof,bytes32 merkleRoot,bytes32 nullifierHash,uint8 voteChoice) external",
  "function tally(uint256 proposalId) external view returns (uint256 yesVotes,uint256 noVotes)",
  "event CommitmentInserted(uint256 indexed proposalId,bytes32 indexed commitment,uint256 indexed leafIndex,bytes32 root,address member)",
]);

function randomField() {
  while (true) {
    const value = BigInt(`0x${crypto.randomBytes(31).toString("hex")}`);
    if (value > 0n && value < FIELD_MODULUS) return value;
  }
}

function proofToHex(proof) {
  if (typeof proof === "string") {
    return proof.startsWith("0x") ? proof : `0x${proof}`;
  }

  return `0x${Array.from(proof)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function waitFor(hash, publicClient) {
  return publicClient.waitForTransactionReceipt({ hash });
}

async function main() {
  const proposalId = BigInt(process.env.PROPOSAL_ID ?? Math.floor(Date.now() / 1000).toString());
  const voteChoice = Number(process.env.VOTE_CHOICE ?? "1");
  if (voteChoice !== 0 && voteChoice !== 1) throw new Error("VOTE_CHOICE must be 0 or 1");

  const deployer = privateKeyToAccount(deployerKey);
  const member = privateKeyToAccount(memberKey);
  const relayer = privateKeyToAccount(relayerKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const deployerWallet = createWalletClient({ account: deployer, chain, transport: http(rpcUrl) });
  const memberWallet = createWalletClient({ account: member, chain, transport: http(rpcUrl) });
  const relayerWallet = createWalletClient({ account: relayer, chain, transport: http(rpcUrl) });

  const membership = getContract({
    address: deployment.DemoMembershipNFT,
    abi: membershipAbi,
    client: { public: publicClient, wallet: deployerWallet },
  });
  const governanceForDeployer = getContract({
    address: deployment.AnonymousGovernance,
    abi: governanceAbi,
    client: { public: publicClient, wallet: deployerWallet },
  });
  const governanceForMember = getContract({
    address: deployment.AnonymousGovernance,
    abi: governanceAbi,
    client: { public: publicClient, wallet: memberWallet },
  });
  const governanceForRelayer = getContract({
    address: deployment.AnonymousGovernance,
    abi: governanceAbi,
    client: { public: publicClient, wallet: relayerWallet },
  });

  console.log("deployer wallet:", deployer.address);
  console.log("member wallet:", member.address);
  console.log("relayer wallet:", relayer.address);

  await waitFor(await membership.write.mint([member.address]), publicClient);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const joinDeadline = now + 3600n;
  const voteDeadline = now + 7200n;
  await waitFor(
    await governanceForDeployer.write.createProposal([proposalId, joinDeadline, voteDeadline]),
    publicClient,
  );

  const nullifier = randomField();
  const secret = randomField();
  const noteSecret = await poseidon2(nullifier, secret);
  const commitment = await poseidon2(1n, noteSecret);

  const joinHash = await governanceForMember.write.joinProposal([proposalId, toFieldHex(commitment)]);
  const joinReceipt = await waitFor(joinHash, publicClient);
  const inserted = await publicClient.getContractEvents({
    address: deployment.AnonymousGovernance,
    abi: governanceAbi,
    eventName: "CommitmentInserted",
    fromBlock: joinReceipt.blockNumber,
    toBlock: joinReceipt.blockNumber,
  });
  const event = inserted.find(
    (entry) => entry.args.commitment?.toLowerCase() === toFieldHex(commitment),
  );
  if (!event) throw new Error("CommitmentInserted event not found");

  const leafIndex = Number(event.args.leafIndex);
  const leaves = [commitment];
  const proofPath = await merkleProof(leaves, leafIndex);
  const nullifierDomain = await poseidon2(2n, proposalId);
  const nullifierHash = await poseidon2(nullifierDomain, nullifier);

  const circuit = JSON.parse(fs.readFileSync("circuits/vote/target/vote.json", "utf8"));
  const bb = await Barretenberg.new();
  const backend = new UltraHonkBackend(circuit.bytecode, bb);
  const noir = new Noir(circuit);

  const inputs = {
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    vote: voteChoice === 1,
    merkle_path: proofPath.siblings.map((value) => value.toString()),
    merkle_indices: proofPath.indices.map((value) => value === 1),
    merkle_root: proofPath.root.toString(),
    proposal_id: proposalId.toString(),
    nullifier_hash: nullifierHash.toString(),
    vote_choice: voteChoice.toString(),
  };

  const { witness } = await noir.execute(inputs);
  const zkProof = await backend.generateProof(witness, { verifierTarget: "evm" });
  const proofHex = proofToHex(zkProof.proof);

  await waitFor(
    await governanceForRelayer.write.castVote([
      proposalId,
      proofHex,
      toFieldHex(proofPath.root),
      toFieldHex(nullifierHash),
      voteChoice,
    ]),
    publicClient,
  );

  await bb.destroy();

  const [yesVotes, noVotes] = await governanceForRelayer.read.tally([proposalId]);
  console.log("saved note:", {
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    commitment: toFieldHex(commitment),
    leafIndex,
  });
  console.log("tally:", { yesVotes: yesVotes.toString(), noVotes: noVotes.toString() });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
