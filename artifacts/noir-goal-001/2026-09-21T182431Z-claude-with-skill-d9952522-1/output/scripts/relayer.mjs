// Relayer: submits castVote from its own wallet so no member's address touches
// a vote. It can't alter a vote (support/nullifier are bound by the proof) and
// learns only what the chain learns — plus the requester's IP, so members should
// reach it over Tor. Anyone can run one; castVote doesn't care who sends it.
//
//   RELAYER_PRIVATE_KEY=0x... node scripts/relayer.mjs
import http from "node:http";
import { ethers } from "ethers";
import { RPC_URL, VOTING_ABI, loadDeployment } from "./lib.mjs";

const PORT = Number(process.env.PORT ?? 8787);
// Random hold before broadcasting blurs "member was online at t" <-> "vote at t".
const MAX_DELAY_MS = Number(process.env.RELAY_MAX_DELAY_MS ?? 0);

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.NonceManager(new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider));
const dep = await loadDeployment(provider);
const voting = new ethers.Contract(dep.voting, VOTING_ABI, wallet);
const relayerAddress = await wallet.getAddress();

async function relay({ proposalId, support, nullifierHash, proof }) {
  if (typeof support !== "boolean" || !ethers.isHexString(proof)) throw new Error("bad request");
  const args = [BigInt(proposalId), support, BigInt(nullifierHash), proof];
  await voting.castVote.staticCall(...args); // reverts on bad proof / double vote: don't pay for it
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * MAX_DELAY_MS)));
  const tx = await voting.castVote(...args);
  await tx.wait();
  return tx.hash;
}

http
  .createServer(async (req, res) => {
    const reply = (code, obj) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(obj));
    if (req.method !== "POST" || req.url !== "/vote") return reply(404, { error: "not found" });
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 100_000) return reply(413, { error: "too large" });
    }
    try {
      reply(200, { txHash: await relay(JSON.parse(body)) });
    } catch (e) {
      reply(400, { error: e.shortMessage ?? e.message }); // deliberately no request logging
    }
  })
  .listen(PORT, () => console.log(`relayer ${relayerAddress} listening on :${PORT}`));

