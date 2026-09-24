#!/usr/bin/env node
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { hash2, toBytes32 } = require("./fieldHash");
const { buildTree } = require("./merkle");

const ROOT_DIR = path.resolve(__dirname, "..");
const PROVER_TOML = path.join(ROOT_DIR, "Prover.toml");
const TARGET_DIR = path.join(ROOT_DIR, "target");
const WITNESS_GZ = path.join(TARGET_DIR, "anonymous_vote.gz");
const BYTECODE_JSON = path.join(TARGET_DIR, "anonymous_vote.json");
const PROOF_DIR = path.join(ROOT_DIR, "proofs", "vote.proof");
const PROOF_PATH = path.join(PROOF_DIR, "proof");
const VK_PATH = path.join(ROOT_DIR, "target", "vote.vk");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      HOME: process.env.NARGO_HOME ? process.env.HOME : path.join(ROOT_DIR, "cache", "home"),
      NARGO_HOME: process.env.NARGO_HOME || path.join(ROOT_DIR, "cache", "nargo"),
    },
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function tomlField(value) {
  return `"${BigInt(value).toString()}"`;
}

function tomlArray(values) {
  return `[${values.map(tomlField).join(", ")}]`;
}

function writeInputs({ root, proposalId, nullifier, vote, secret, siblings, indices }) {
  const toml = [
    `root = ${tomlField(root)}`,
    `proposal_id = ${tomlField(proposalId)}`,
    `nullifier = ${tomlField(nullifier)}`,
    `vote = ${tomlField(vote)}`,
    `secret = ${tomlField(secret)}`,
    `path = ${tomlArray(siblings)}`,
    `path_indices = ${tomlArray(indices)}`,
    "",
  ].join("\n");
  fs.writeFileSync(PROVER_TOML, toml);
}

function defaultSecrets(memberCount) {
  return Array.from({ length: memberCount }, (_, i) => hash2(BigInt(i + 1), 424242n));
}

async function main() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const relayerKey =
    process.env.RELAYER_PRIVATE_KEY || "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const votingAddress = process.env.VOTING_ADDRESS;
  const dryRun = process.env.DRY_RUN === "1";
  const proposalId = BigInt(process.env.PROPOSAL_ID || "1");
  const memberIndex = Number(process.env.MEMBER_INDEX || "0");
  const vote = BigInt(process.env.VOTE || "1");
  const memberCount = Number(process.env.MEMBER_COUNT || "150");

  if (vote !== 0n && vote !== 1n) {
    throw new Error("VOTE must be 0 or 1");
  }
  if (!votingAddress && !dryRun) {
    throw new Error("set VOTING_ADDRESS to the deployed AnonymousVoting contract");
  }

  const secrets = defaultSecrets(memberCount);
  if (process.env.MEMBER_SECRET) {
    secrets[memberIndex] = BigInt(process.env.MEMBER_SECRET);
  }
  const secret = secrets[memberIndex];
  const leaves = secrets.map((item) => hash2(item, 1n));
  const tree = buildTree(leaves);
  const { siblings, indices } = tree.path(memberIndex);
  const nullifier = hash2(secret, proposalId);

  writeInputs({ root: tree.root, proposalId, nullifier, vote, secret, siblings, indices });

  fs.mkdirSync(PROOF_DIR, { recursive: true });
  run("nargo", ["execute"]);
  run("bb", [
    "prove",
    "-b",
    BYTECODE_JSON,
    "-w",
    WITNESS_GZ,
    "-o",
    PROOF_DIR,
    "--write_vk",
    "-k",
    VK_PATH,
    "-t",
    "evm",
  ]);

  const proof = fs.readFileSync(PROOF_PATH);
  console.log(`generated proof: ${PROOF_PATH}`);
  console.log(`member root: ${toBytes32(tree.root)}`);
  console.log(`nullifier:   ${toBytes32(nullifier)}`);

  if (dryRun) {
    console.log("DRY_RUN=1 set, skipping vote transaction");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const relayer = new ethers.Wallet(relayerKey, provider);
  const voting = new ethers.Contract(
    votingAddress,
    [
      "function submitVote(uint256 proposalId, bytes32 root, bytes32 nullifier, bool support, bytes proof)",
      "function tally(uint256 proposalId) view returns (uint64 yes, uint64 no, uint64 deadline)",
    ],
    relayer,
  );

  const tx = await voting.submitVote(
    proposalId,
    toBytes32(tree.root),
    toBytes32(nullifier),
    vote === 1n,
    `0x${proof.toString("hex")}`,
  );
  console.log(`submitted vote tx: ${tx.hash}`);
  await tx.wait();

  const tally = await voting.tally(proposalId);
  console.log(`tally yes=${tally.yes} no=${tally.no} deadline=${tally.deadline}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
