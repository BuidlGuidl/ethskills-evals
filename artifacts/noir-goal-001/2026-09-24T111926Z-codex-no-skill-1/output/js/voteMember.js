#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ethers } = require("ethers");
const {
  TREE_DEPTH,
  buildTree,
  leafFromSecret,
  merklePath,
  nullifierFor,
  toHex32,
} = require("./fieldHash");

const ROOT = path.resolve(__dirname, "..");
const CIRCUIT_DIR = path.join(ROOT, "circuits", "vote");
const PROOF_DIR = path.join(ROOT, "target", "noir", "proofs", "member-vote");

const DEFAULT_KEYS = {
  deployer: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  member: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  relayer: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    stdio: options.stdio || "inherit",
    env: {
      ...process.env,
      HOME: path.join(ROOT, ".tool-home"),
      XDG_CACHE_HOME: path.join(ROOT, ".cache"),
      npm_config_cache: path.join(ROOT, ".npm-cache"),
      ...options.env,
    },
  });

  if (result.status !== 0) {
    const stdout = result.stdout ? result.stdout.toString() : "";
    const stderr = result.stderr ? result.stderr.toString() : "";
    throw new Error(`${command} ${args.join(" ")} failed\n${stdout}\n${stderr}`);
  }

  return result;
}

function artifact(file, contract) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "out", file, `${contract}.json`), "utf8"));
}

async function deployIfNeeded(deployer) {
  const configuredVote = process.env.PRIVATE_VOTE_ADDRESS;
  const configuredNft = process.env.MEMBERSHIP_NFT_ADDRESS;

  if (configuredVote && configuredNft) {
    return { voteAddress: configuredVote, nftAddress: configuredNft };
  }

  run("forge", ["build"], { stdio: "pipe" });

  const deploy = run(
    "forge",
    [
      "script",
      "script/Deploy.s.sol:Deploy",
      "--rpc-url",
      process.env.RPC_URL || "http://127.0.0.1:8545",
      "--private-key",
      deployer.privateKey,
      "--broadcast",
      "--json",
    ],
    { stdio: "pipe" },
  );

  const lines = deploy.stdout.toString().trim().split(/\n+/);
  const result = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch (_) {
      return null;
    }
  }).find((item) => item && item.returns && item.returns.membership && item.returns.vote);

  if (!result) {
    throw new Error(`could not parse forge deploy output:\n${deploy.stdout.toString()}\n${deploy.stderr.toString()}`);
  }

  return {
    nftAddress: result.returns.membership.value,
    voteAddress: result.returns.vote.value,
  };
}

function asTomlField(value) {
  return `"${BigInt(value).toString()}"`;
}

function writeProverToml({ secret, pathElements, pathIndices, proposalId, merkleRoot, nullifier, voteChoice }) {
  const toml = [
    `secret = ${asTomlField(secret)}`,
    `path = [${pathElements.map(asTomlField).join(", ")}]`,
    `path_indices = [${pathIndices.map((bit) => (bit ? "true" : "false")).join(", ")}]`,
    `proposal_id = ${asTomlField(proposalId)}`,
    `merkle_root = ${asTomlField(merkleRoot)}`,
    `nullifier = ${asTomlField(nullifier)}`,
    `vote = ${asTomlField(voteChoice)}`,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(CIRCUIT_DIR, "Prover.toml"), toml);
}

function ensureProofArtifacts() {
  run("nargo", ["compile"], { cwd: CIRCUIT_DIR });

  const vkPath = path.join(ROOT, "target", "noir", "vote.vk", "vk");
  if (!fs.existsSync(vkPath)) {
    fs.mkdirSync(path.dirname(path.dirname(vkPath)), { recursive: true });
    run("bb", ["write_vk", "-b", "circuits/vote/target/vote.json", "-o", "target/noir/vote.vk", "-t", "evm"]);
  }

  run("nargo", ["execute", "member_vote"], { cwd: CIRCUIT_DIR });

  fs.mkdirSync(PROOF_DIR, { recursive: true });
  run("bb", [
    "prove",
    "-b",
    "circuits/vote/target/vote.json",
    "-w",
    "circuits/vote/target/member_vote.gz",
    "-k",
    "target/noir/vote.vk/vk",
    "-o",
    "target/noir/proofs/member-vote",
    "-t",
    "evm",
    "--verify",
  ]);

  return `0x${fs.readFileSync(path.join(PROOF_DIR, "proof")).toString("hex")}`;
}

async function readRegisteredLeaves(voteContract) {
  const events = await voteContract.queryFilter(voteContract.filters.CommitmentRegistered(), 0, "latest");
  const leaves = [];
  for (const event of events) {
    leaves[Number(event.args.leafIndex)] = BigInt(event.args.commitment.toString());
  }
  return leaves;
}

async function main() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY || DEFAULT_KEYS.deployer, provider);
  const member = new ethers.Wallet(process.env.MEMBER_PRIVATE_KEY || DEFAULT_KEYS.member, provider);
  const relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY || DEFAULT_KEYS.relayer, provider);

  const { voteAddress, nftAddress } = await deployIfNeeded(deployer);
  const nftArtifact = artifact("PrivateVote.sol", "DemoMembershipNFT");
  const voteArtifact = artifact("PrivateVote.sol", "PrivateVote");

  const nftAsDeployer = new ethers.Contract(nftAddress, nftArtifact.abi, deployer);
  const voteAsMember = new ethers.Contract(voteAddress, voteArtifact.abi, member);
  const voteAsDeployer = new ethers.Contract(voteAddress, voteArtifact.abi, deployer);
  const voteAsRelayer = new ethers.Contract(voteAddress, voteArtifact.abi, relayer);

  const secret = BigInt(process.env.MEMBER_SECRET || "123456789123456789123456789");
  const voteChoice = BigInt(process.env.VOTE_CHOICE || "1");
  const proposalId = BigInt(process.env.PROPOSAL_ID || "1");
  const commitment = leafFromSecret(secret);

  const mintTx = await nftAsDeployer.mint(member.address);
  const mintReceipt = await mintTx.wait();
  const tokenId = BigInt(mintReceipt.logs.map((log) => {
    try {
      return nftAsDeployer.interface.parseLog(log);
    } catch (_) {
      return null;
    }
  }).find((log) => log && log.name === "Transfer").args.tokenId.toString());

  const registerTx = await voteAsMember.register(tokenId, commitment);
  const registerReceipt = await registerTx.wait();

  const leaves = await readRegisteredLeaves(voteAsDeployer);
  const leafIndex = leaves.findIndex((leaf) => leaf === commitment);
  if (leafIndex < 0) throw new Error("registered commitment was not found in event log");

  const { root, levels } = buildTree(leaves);
  const onchainRoot = BigInt((await voteAsDeployer.currentRoot()).toString());
  if (root !== onchainRoot) {
    throw new Error(`offchain root ${root} does not match onchain root ${onchainRoot}`);
  }

  const block = await provider.getBlock("latest");
  const deadline = BigInt(block.timestamp + 3600);
  const createProposalTx = await voteAsDeployer.createProposal(proposalId, root, deadline);
  await createProposalTx.wait();

  const { path: pathElements, pathIndices } = merklePath(levels, leafIndex, TREE_DEPTH);
  const nullifier = nullifierFor(secret, proposalId);

  writeProverToml({ secret, pathElements, pathIndices, proposalId, merkleRoot: root, nullifier, voteChoice });
  const proof = ensureProofArtifacts();

  const castTx = await voteAsRelayer.castVote(proposalId, root, nullifier, Number(voteChoice), proof);
  await castTx.wait();

  const tally = await voteAsDeployer.tally(proposalId);

  console.log("\nPrivate vote demo complete");
  console.log(`membership NFT: ${nftAddress}`);
  console.log(`private vote:   ${voteAddress}`);
  console.log(`member wallet:  ${member.address}`);
  console.log(`relayer wallet: ${relayer.address}`);
  console.log(`mint tx:        ${mintReceipt.hash}`);
  console.log(`register tx:    ${registerReceipt.hash}`);
  console.log(`vote tx:        ${castTx.hash}`);
  console.log(`proposal id:    ${proposalId.toString()}`);
  console.log(`root:           ${toHex32(root)}`);
  console.log(`nullifier:      ${toHex32(nullifier)}`);
  console.log(`tally:          yes=${tally.yesVotes.toString()} no=${tally.noVotes.toString()} final=${tally.final_}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
