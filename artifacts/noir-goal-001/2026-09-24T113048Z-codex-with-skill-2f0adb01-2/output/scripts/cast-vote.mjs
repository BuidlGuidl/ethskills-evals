import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon2 } from "poseidon-lite";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const MAX_DEPTH = 8;

const votingAbi = [
  "event CommitmentInserted(bytes32 indexed commitment, uint256 indexed leafIndex, bytes32 root)",
  "function joinVote(bytes32 commitment) external returns (uint256 leafIndex, bytes32 root)",
  "function castVote(bytes proof, bytes32 merkleRoot, uint256 proposalId, bool support, bytes32 nullifierHash) external",
  "function knownRoots(bytes32 root) external view returns (bool)",
  "function proposals(uint256 proposalId) external view returns (uint64 deadline, uint64 yesVotes, uint64 noVotes, bool exists)"
];

function fieldFromRandom() {
  return BigInt(`0x${randomBytes(31).toString("hex")}`) % FIELD_MODULUS;
}

function toFieldHex(value) {
  const v = BigInt(value);
  return `0x${v.toString(16).padStart(64, "0")}`;
}

function bytesToHex(bytes) {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function hash2(left, right) {
  return poseidon2([BigInt(left), BigInt(right)]);
}

function findDeploymentAddress(contractName) {
  const path = join(rootDir, "broadcast", "DeployLocal.s.sol", "31337", "run-latest.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  const tx = data.transactions.find((entry) => entry.contractName === contractName && entry.contractAddress);
  if (!tx) {
    throw new Error(`Could not find ${contractName} in ${path}`);
  }
  return tx.contractAddress;
}

async function main() {
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const member = process.env.MEMBER_PRIVATE_KEY
    ? new ethers.Wallet(process.env.MEMBER_PRIVATE_KEY, provider)
    : await provider.getSigner(1);
  const relayer = process.env.RELAYER_PRIVATE_KEY
    ? new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider)
    : await provider.getSigner(2);
  const votingAddress = process.env.VOTING_ADDRESS ?? findDeploymentAddress("NoirPrivateVoting");
  const proposalId = BigInt(process.env.PROPOSAL_ID ?? "1");
  const support = (process.env.SUPPORT ?? "true") !== "false";

  const votingAsMember = new ethers.Contract(votingAddress, votingAbi, member);
  const votingAsRelayer = new ethers.Contract(votingAddress, votingAbi, relayer);

  const nullifier = process.env.NULLIFIER ? BigInt(process.env.NULLIFIER) : fieldFromRandom();
  const secret = process.env.SECRET ? BigInt(process.env.SECRET) : fieldFromRandom();
  const noteSecret = hash2(nullifier, secret);
  const commitment = hash2(1n, noteSecret);

  console.log("member wallet", await member.getAddress());
  console.log("vote sender", await relayer.getAddress());
  console.log("commitment", toFieldHex(commitment));

  const joinTx = await votingAsMember.joinVote(toFieldHex(commitment));
  const joinReceipt = await joinTx.wait();
  console.log("join tx", joinReceipt.hash);

  const filter = votingAsRelayer.filters.CommitmentInserted();
  const events = await votingAsRelayer.queryFilter(filter, 0, "latest");
  const leaves = events.map((event) => BigInt(event.args.commitment));
  const tree = new LeanIMT(hash2, leaves);
  const leafIndex = leaves.findIndex((leaf) => leaf === commitment);
  if (leafIndex === -1) {
    throw new Error("Inserted commitment was not found in event replay");
  }

  const proof = tree.generateProof(leafIndex);
  if (proof.siblings.length > MAX_DEPTH) {
    throw new Error(`Proof depth ${proof.siblings.length} exceeds circuit MAX_DEPTH ${MAX_DEPTH}`);
  }

  const siblings = Array.from({ length: MAX_DEPTH }, (_, i) => toFieldHex(proof.siblings[i] ?? 0n));
  const pathIndices = Array.from({ length: MAX_DEPTH }, (_, i) => ((BigInt(proof.index) >> BigInt(i)) & 1n) === 1n);
  const merkleRoot = toFieldHex(proof.root);
  const nullifierDomain = hash2(2n, proposalId);
  const nullifierHash = hash2(nullifierDomain, nullifier);

  const known = await votingAsRelayer.knownRoots(merkleRoot);
  if (!known) {
    throw new Error(`Root ${merkleRoot} is not accepted by the contract`);
  }

  const circuitPath = join(rootDir, "circuits", "vote", "target", "vote.json");
  const circuit = JSON.parse(readFileSync(circuitPath, "utf8"));
  const noir = new Noir(circuit);
  const bb = await Barretenberg.new();
  const backend = new UltraHonkBackend(circuit.bytecode, bb);

  const inputs = {
    nullifier: toFieldHex(nullifier),
    secret: toFieldHex(secret),
    siblings,
    path_indices: pathIndices,
    path_length: proof.siblings.length,
    merkle_root: merkleRoot,
    proposal_id: toFieldHex(proposalId),
    vote: support ? "1" : "0",
    nullifier_hash: toFieldHex(nullifierHash)
  };

  const { witness } = await noir.execute(inputs);
  const generated = await backend.generateProof(witness, { verifierTarget: "evm" });
  const publicInputs = generated.publicInputs.map((value) => toFieldHex(value));
  const expectedPublicInputs = [merkleRoot, toFieldHex(proposalId), support ? toFieldHex(1n) : toFieldHex(0n), toFieldHex(nullifierHash)];

  for (let i = 0; i < expectedPublicInputs.length; i += 1) {
    if (publicInputs[i].toLowerCase() !== expectedPublicInputs[i].toLowerCase()) {
      throw new Error(`Public input ${i} mismatch: got ${publicInputs[i]}, expected ${expectedPublicInputs[i]}`);
    }
  }

  const voteTx = await votingAsRelayer.castVote(
    bytesToHex(generated.proof),
    merkleRoot,
    proposalId,
    support,
    toFieldHex(nullifierHash)
  );
  const voteReceipt = await voteTx.wait();
  const proposal = await votingAsRelayer.proposals(proposalId);

  console.log("vote tx", voteReceipt.hash);
  console.log("proposal tally", { yes: proposal.yesVotes.toString(), no: proposal.noVotes.toString() });

  await bb.destroy?.();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
