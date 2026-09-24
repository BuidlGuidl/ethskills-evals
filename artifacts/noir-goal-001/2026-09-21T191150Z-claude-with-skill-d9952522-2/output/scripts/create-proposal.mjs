// Open a proposal. Sent by any NFT holder; the proposer is public.
//   MEMBER_KEY=0x... DESCRIPTION="Fund X" VOTING_SECONDS=3600 node scripts/create-proposal.mjs
import { ethers } from "ethers";
import { RPC_URL, contracts, loadDeployment } from "./shared/common.mjs";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.MEMBER_KEY, provider);
const { voting } = contracts(await loadDeployment(provider), wallet);

const now = (await provider.getBlock("latest")).timestamp;
const deadline = now + Number(process.env.VOTING_SECONDS ?? 3600);
const tx = await voting.createProposal(ethers.id(process.env.DESCRIPTION ?? "proposal"), deadline);
const receipt = await tx.wait();
const ev = receipt.logs.map((l) => voting.interface.parseLog(l)).find((e) => e?.name === "ProposalCreated");
console.log(`proposal ${ev.args.proposalId} open until ${deadline}, ${ev.args.eligibleMembers} eligible members`);
