import fs from "fs";
import { ethers } from "ethers";
import {
  addressToField,
  buildMerkleTree,
  bytesToHex,
  contractAt,
  deployCore,
  getWallets,
  makeHasher,
  merkleProof,
  proveVote,
  randomField,
  toFieldHex,
} from "./privateVote.mjs";

const { provider, owner, member, relayer } = getWallets();
const hasher = await makeHasher().init();

try {
  let membership;
  let governor;

  if (process.env.MEMBERSHIP_ADDRESS && process.env.GOVERNOR_ADDRESS) {
    membership = contractAt("MembershipNFT", process.env.MEMBERSHIP_ADDRESS, owner);
    governor = contractAt("PrivateGovernor", process.env.GOVERNOR_ADDRESS, owner);
  } else if (fs.existsSync("deployed.json")) {
    const deployed = JSON.parse(fs.readFileSync("deployed.json", "utf8"));
    membership = contractAt("MembershipNFT", deployed.membership, owner);
    governor = contractAt("PrivateGovernor", deployed.governor, owner);
  } else {
    ({ membership, governor } = await deployCore(owner));
  }

  const memberGovernor = governor.connect(member);
  const relayerGovernor = governor.connect(relayer);
  let ownerNonce = await owner.getNonce("pending");

  if ((await membership.balanceOf(member.address)) === 0n) {
    await (await membership.mint(member.address, { nonce: ownerNonce++ })).wait();
  }

  const identitySecret = process.env.IDENTITY_SECRET
    ? BigInt(process.env.IDENTITY_SECRET)
    : randomField();
  const commitment = hasher.hash1(identitySecret);

  if ((await governor.commitmentOf(member.address)) === ethers.ZeroHash) {
    await (await memberGovernor.registerCommitment(commitment)).wait();
  }

  const leaves = [commitment];
  const memberLeafIndex = 0;
  const { root, layers } = buildMerkleTree(leaves, hasher);
  const latestBlock = await provider.getBlock("latest");
  const deadline = BigInt(latestBlock.timestamp + 3600);

  const createTx = await governor.createProposal(root, deadline, { nonce: ownerNonce++ });
  const createReceipt = await createTx.wait();
  const created = createReceipt.logs
    .map((log) => {
      try {
        return governor.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log) => log?.name === "ProposalCreated");
  const proposalId = created.args.proposalId;

  const voteYes = process.env.VOTE === "no" ? 0n : 1n;
  const nullifierHash = hasher.hash4(
    identitySecret,
    proposalId,
    addressToField(await governor.getAddress()),
    (await provider.getNetwork()).chainId,
  );
  const { merklePath, pathIndices } = merkleProof(layers, memberLeafIndex);

  const proofInputs = {
    identity_secret: toFieldHex(identitySecret),
    merkle_path: merklePath,
    path_indices: pathIndices,
    root,
    proposal_id: toFieldHex(proposalId),
    vote: toFieldHex(voteYes),
    nullifier_hash: nullifierHash,
    vote_contract: toFieldHex(addressToField(await governor.getAddress())),
    chain_id: toFieldHex((await provider.getNetwork()).chainId),
  };

  const proofData = await proveVote(proofInputs);
  const voteTx = await relayerGovernor.castVote(
    proposalId,
    voteYes === 1n,
    nullifierHash,
    bytesToHex(proofData.proof),
  );
  const voteReceipt = await voteTx.wait();

  console.log(
    JSON.stringify(
      {
        member: member.address,
        relayer: relayer.address,
        governor: await governor.getAddress(),
        proposalId: proposalId.toString(),
        root,
        commitment,
        nullifierHash,
        vote: voteYes === 1n ? "yes" : "no",
        voteTx: voteReceipt.hash,
      },
      null,
      2,
    ),
  );
} finally {
  hasher.destroy();
}
