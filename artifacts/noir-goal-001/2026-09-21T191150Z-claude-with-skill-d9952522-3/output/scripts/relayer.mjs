// Relayer: submits votes from ITS OWN wallet so msg.sender never points at a member.
//
//   RELAYER_KEY=0x... PORT=8787 node scripts/relayer.mjs
//
// It cannot alter a vote (the proof binds root, scope, vote and nullifier hash) and
// cannot vote on anyone's behalf; the worst it can do is refuse to relay. It does see
// the requester's IP and the vote, so members should reach it over Tor/a VPN, and
// anyone (including a member's friend) can run another one: castVote is permissionless.
import http from "node:http";
import { ethers } from "ethers";
import { VOTING_ABI, loadDeployment } from "./lib.mjs";

const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const port = Number(process.env.PORT ?? 8787);
// Random hold before broadcasting, so submission time != proving time (0 for the demo).
const maxDelayMs = Number(process.env.MAX_DELAY_MS ?? 0);
if (!process.env.RELAYER_KEY) throw new Error("set RELAYER_KEY");

const provider = new ethers.JsonRpcProvider(rpc);
const wallet = new ethers.NonceManager(new ethers.Wallet(process.env.RELAYER_KEY, provider));
const { chainId } = await provider.getNetwork();
const voting = new ethers.Contract(loadDeployment(chainId).voting, VOTING_ABI, wallet);

async function relay({ proposalId, vote, nullifierHash, proof }) {
  const args = [BigInt(proposalId), BigInt(vote), BigInt(nullifierHash), proof];
  await voting.castVote.staticCall(...args); // reverts here (free) on a bad proof / reused nullifier
  if (maxDelayMs > 0) await new Promise((r) => setTimeout(r, Math.random() * maxDelayMs));
  const receipt = await (await voting.castVote(...args)).wait();
  return { txHash: receipt.hash, gasUsed: receipt.gasUsed.toString() };
}

http
  .createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/vote") return res.writeHead(404).end();
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const out = await relay(JSON.parse(body));
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: e.shortMessage ?? e.message }));
      }
    });
  })
  .listen(port, async () => console.log(`relayer ${await wallet.getAddress()} listening on :${port}`));
