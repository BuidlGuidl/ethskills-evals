import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import * as circomlibjs from "circomlibjs";
import { ethers } from "ethers";

const TREE_DEPTH = 8;
const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEFAULT_MEMBER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const DEFAULT_RELAYER_KEY =
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a";

const rootDir = process.cwd();
const notePath = path.join(rootDir, "private-notes", "member-note.local.json");

const rpcUrl = process.env.RPC_URL ?? DEFAULT_RPC_URL;
const proposalId = BigInt(process.env.PROPOSAL_ID ?? "1");
const support = (process.env.VOTE ?? "yes").toLowerCase() !== "no";

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function artifact(name) {
  const files = {
    HonkVerifier: "out/Verifier.sol/HonkVerifier.json",
    MembershipNFT: "out/MembershipNFT.sol/MembershipNFT.json",
    PoseidonT3: "out/PoseidonT3.sol/PoseidonT3.json",
    PrivateVote: "out/PrivateVote.sol/PrivateVote.json",
  };
  return readJson(files[name]);
}

function linkedBytecode(contractArtifact, libraries) {
  let bytecode = contractArtifact.bytecode.object;
  for (const [sourceName, contracts] of Object.entries(contractArtifact.bytecode.linkReferences ?? {})) {
    for (const [contractName, references] of Object.entries(contracts)) {
      const address = libraries[`${sourceName}:${contractName}`]?.replace(/^0x/, "");
      if (!address) throw new Error(`Missing library address for ${sourceName}:${contractName}`);
      for (const { start, length } of references) {
        const from = 2 + start * 2;
        const to = from + length * 2;
        bytecode = `${bytecode.slice(0, from)}${address}${bytecode.slice(to)}`;
      }
    }
  }
  return bytecode;
}

function toBytes32(value) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32);
}

function normalizeBytes32(value) {
  return toBytes32(BigInt(value));
}

function randomField() {
  let value = 0n;
  while (value === 0n || value >= FIELD_MODULUS) {
    value = BigInt(`0x${randomBytes(31).toString("hex")}`);
  }
  return value;
}

function makeHasher(poseidon) {
  return (left, right) => BigInt(poseidon.F.toObject(poseidon([BigInt(left), BigInt(right)])));
}

function buildZeroes(hashPair) {
  const zeroes = [];
  let zero = 0n;
  for (let i = 0; i < TREE_DEPTH; i++) {
    zeroes.push(zero);
    zero = hashPair(zero, zero);
  }
  return zeroes;
}

function buildMerkleWitness(leaves, leafIndex, hashPair) {
  const zeroes = buildZeroes(hashPair);
  const pathElements = [];
  const pathIndices = [];

  let index = leafIndex;
  let level = leaves.map(BigInt);

  for (let depth = 0; depth < TREE_DEPTH; depth++) {
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const sibling = siblingIndex < level.length ? level[siblingIndex] : zeroes[depth];

    pathElements.push(sibling);
    pathIndices.push(isRight);

    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : zeroes[depth];
      next.push(hashPair(left, right));
    }

    level = next;
    index = Math.floor(index / 2);
  }

  return { pathElements, pathIndices, root: level[0] };
}

async function deployFreshStack(deployer, member) {
  const membershipArtifact = artifact("MembershipNFT");
  const poseidonArtifact = artifact("PoseidonT3");
  const verifierArtifact = artifact("HonkVerifier");
  const voteArtifact = artifact("PrivateVote");
  let nonce = await deployer.provider.getTransactionCount(await deployer.getAddress(), "latest");

  const membership = await new ethers.ContractFactory(
    membershipArtifact.abi,
    membershipArtifact.bytecode.object,
    deployer,
  ).deploy({ nonce: nonce++ });
  await membership.waitForDeployment();

  const verifier = await new ethers.ContractFactory(
    verifierArtifact.abi,
    verifierArtifact.bytecode.object,
    deployer,
  ).deploy({ nonce: nonce++ });
  await verifier.waitForDeployment();

  const poseidon = await new ethers.ContractFactory(
    poseidonArtifact.abi,
    poseidonArtifact.bytecode.object,
    deployer,
  ).deploy({ nonce: nonce++ });
  await poseidon.waitForDeployment();

  const privateVoteBytecode = linkedBytecode(voteArtifact, {
    "src/vendor/PoseidonT3.sol:PoseidonT3": await poseidon.getAddress(),
  });
  const privateVote = await new ethers.ContractFactory(
    voteArtifact.abi,
    privateVoteBytecode,
    deployer,
  ).deploy(await verifier.getAddress(), await membership.getAddress(), { nonce: nonce++ });
  await privateVote.waitForDeployment();

  await (await membership.mint(await member.getAddress(), { nonce: nonce++ })).wait();
  await (
    await privateVote.createProposal(proposalId, Math.floor(Date.now() / 1000) + 86_400, {
      nonce: nonce++,
    })
  ).wait();

  return {
    membershipAddress: await membership.getAddress(),
    poseidonAddress: await poseidon.getAddress(),
    verifierAddress: await verifier.getAddress(),
    privateVoteAddress: await privateVote.getAddress(),
  };
}

async function loadOrCreateNote(hashPair) {
  if (existsSync(notePath)) {
    const note = JSON.parse(await readFile(notePath, "utf8"));
    return {
      nullifier: BigInt(note.nullifier),
      secret: BigInt(note.secret),
      commitment: BigInt(note.commitment),
    };
  }

  const nullifier = randomField();
  const secret = randomField();
  const commitment = hashPair(nullifier, secret);

  await mkdir(path.dirname(notePath), { recursive: true });
  await writeFile(
    notePath,
    JSON.stringify(
      {
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        commitment: commitment.toString(),
        warning: "Demo note. Keep real nullifier/secret notes private and backed up.",
      },
      null,
      2,
    ),
  );

  return { nullifier, secret, commitment };
}

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY ?? DEFAULT_DEPLOYER_KEY, provider);
  const member = new ethers.Wallet(process.env.MEMBER_PRIVATE_KEY ?? DEFAULT_MEMBER_KEY, provider);
  const relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY ?? DEFAULT_RELAYER_KEY, provider);

  const poseidon = await circomlibjs.buildPoseidon();
  const hashPair = makeHasher(poseidon);
  const note = await loadOrCreateNote(hashPair);

  let privateVoteAddress = process.env.PRIVATE_VOTE_ADDRESS;
  let membershipAddress = process.env.MEMBERSHIP_ADDRESS;
  let verifierAddress = process.env.VERIFIER_ADDRESS;

  if (!privateVoteAddress) {
    const deployed = await deployFreshStack(deployer, member);
    privateVoteAddress = deployed.privateVoteAddress;
    membershipAddress = deployed.membershipAddress;
    verifierAddress = deployed.verifierAddress;
    console.log("Deployed local stack:");
    console.log(`  MembershipNFT: ${membershipAddress}`);
    console.log(`  PoseidonT3:     ${deployed.poseidonAddress}`);
    console.log(`  HonkVerifier:  ${verifierAddress}`);
    console.log(`  PrivateVote:   ${privateVoteAddress}`);
  }

  const voteArtifact = artifact("PrivateVote");
  const privateVote = new ethers.Contract(privateVoteAddress, voteArtifact.abi, provider);
  const memberVote = privateVote.connect(member);

  const hasJoined = await privateVote.hasJoined(await member.getAddress());
  if (!hasJoined) {
    const tx = await memberVote.join(note.commitment.toString());
    const receipt = await tx.wait();
    const joined = receipt.logs
      .map((log) => {
        try {
          return privateVote.interface.parseLog(log);
        } catch {
          return undefined;
        }
      })
      .find((event) => event?.name === "CommitmentJoined");
    console.log(
      `Member joined anonymity set: leaf ${joined.args.leafIndex.toString()}, tx ${receipt.hash}`,
    );
  } else {
    console.log("Member already joined; reusing persisted local note.");
  }

  const joinEvents = await privateVote.queryFilter(privateVote.filters.CommitmentJoined(), 0, "latest");
  const leaves = joinEvents.map((event) => BigInt(event.args.commitment));
  const leafIndex = leaves.findIndex((leaf) => leaf === note.commitment);
  if (leafIndex === -1) {
    throw new Error("Persisted commitment was not found in onchain join events.");
  }

  const merkle = buildMerkleWitness(leaves, leafIndex, hashPair);
  const onchainRoot = BigInt(await privateVote.currentRoot());
  if (merkle.root !== onchainRoot) {
    throw new Error(`Offchain root ${merkle.root} does not match onchain root ${onchainRoot}.`);
  }

  const voteField = support ? 1n : 0n;
  const nullifierHash = hashPair(note.nullifier, proposalId);
  const inputs = {
    nullifier: note.nullifier.toString(),
    secret: note.secret.toString(),
    path_elements: merkle.pathElements.map((value) => value.toString()),
    path_indices: merkle.pathIndices,
    root: merkle.root.toString(),
    proposal_id: proposalId.toString(),
    vote: voteField.toString(),
    nullifier_hash: nullifierHash.toString(),
  };

  const circuit = readJson("circuits/vote/target/vote.json");
  const noir = new Noir(circuit);
  await noir.init();
  const { witness } = await noir.execute(inputs);

  const api = await Barretenberg.new();
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const proofData = await backend.generateProof(witness, { verifierTarget: "evm" });

  const expectedPublicInputs = [merkle.root, proposalId, voteField, nullifierHash].map(toBytes32);
  const proofPublicInputs = proofData.publicInputs.map(normalizeBytes32);
  if (JSON.stringify(proofPublicInputs) !== JSON.stringify(expectedPublicInputs)) {
    throw new Error("Noir public inputs do not match the contract public input order.");
  }

  const verifiedLocally = await backend.verifyProof(proofData, { verifierTarget: "evm" });
  if (!verifiedLocally) throw new Error("Generated proof failed local bb.js verification.");

  const relayedVote = privateVote.connect(relayer);
  const voteTx = await relayedVote.submitVote(
    proposalId.toString(),
    support,
    ethers.hexlify(proofData.proof),
    proofPublicInputs,
  );
  const voteReceipt = await voteTx.wait();

  console.log(`Relayer submitted ${support ? "YES" : "NO"} vote: tx ${voteReceipt.hash}`);
  console.log(`Public nullifier hash for this proposal: ${toBytes32(nullifierHash)}`);

  await api.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
