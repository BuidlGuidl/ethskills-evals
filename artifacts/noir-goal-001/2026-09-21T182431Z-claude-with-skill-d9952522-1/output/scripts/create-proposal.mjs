// Any NFT holder opens a proposal; it snapshots the current member tree root.
//
//   MEMBER_PRIVATE_KEY=0x... node scripts/create-proposal.mjs --token 1 --text "Fund X" --period 86400
import { ethers } from "ethers";
import { RPC_URL, VOTING_ABI, arg, loadDeployment } from "./lib.mjs";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.MEMBER_PRIVATE_KEY, provider);
const dep = await loadDeployment(provider);
const voting = new ethers.Contract(dep.voting, VOTING_ABI, wallet);

const text = arg("text");
const receipt = await (
  await voting.createProposal(BigInt(arg("token")), ethers.keccak256(ethers.toUtf8Bytes(text)), BigInt(arg("period", "86400")))
).wait();
const ev = receipt.logs.map((l) => voting.interface.parseLog(l)).find((e) => e?.name === "ProposalCreated");
console.log(`proposal ${ev.args.proposalId} "${text}": ${ev.args.memberCount} eligible members, deadline ${ev.args.deadline}`);
