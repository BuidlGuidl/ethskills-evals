// Minimal vote relayer. Anyone can run one (a member, a friendly DAO, a public service);
// members should be free to pick any relayer, or several, so no single operator -
// including the DAO team - is a mandatory chokepoint.
//
// The relayer pays gas and becomes msg.sender of castVote. It learns the vote and
// nullifier (both public onchain anyway) plus network metadata (IP, timing). It cannot
// change the vote: support and nullifier are public inputs bound by the proof.
// It deliberately keeps no logs of requester addresses.
//
//   RELAYER_PRIVATE_KEY=0x.. PORT=8787 node scripts/relayer.mjs
import http from "node:http";
import { ethers } from "ethers";
import { connect, env } from "./lib.mjs";

const ctx = await connect();
const wallet = new ethers.Wallet(env("RELAYER_PRIVATE_KEY"), ctx.provider);
const voting = ctx.voting.connect(wallet);
if ((await ctx.nft.balanceOf(wallet.address)) > 0n) {
  console.warn("warning: this relayer wallet holds a membership NFT; members may reasonably distrust it");
}

async function relay({ proposalId, support, nullifier, proof }) {
  const args = [BigInt(proposalId), Boolean(support), BigInt(nullifier), proof];
  await voting.castVote.staticCall(...args); // reject bad/duplicate votes without spending gas
  const tx = await voting.castVote(...args);
  const rcpt = await tx.wait();
  console.log(`relayed vote on proposal ${proposalId}: tx ${tx.hash}, gas ${rcpt.gasUsed}`);
  return tx.hash;
}

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/vote") return res.writeHead(404).end();
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const hash = await relay(JSON.parse(body));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ txHash: hash }));
    } catch (e) {
      const reason = e.revert?.name ?? e.shortMessage ?? e.message;
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: reason }));
    }
  })
  .listen(Number(env("PORT", "8787")), () => console.log(`relayer ${wallet.address} listening on :${env("PORT", "8787")}`));
