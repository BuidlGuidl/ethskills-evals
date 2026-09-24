// Relayer: the only wallet that ever sends castVote. It needs gas money and
// nothing else — no membership, no secrets. It cannot change a vote (the vote is
// a public input bound into the proof); the worst it can do is refuse to relay,
// in which case the member takes the same proof to any other relayer.
//
//   RELAYER_KEY=0x... PORT=8787 MAX_DELAY_MS=0 node scripts/relayer.mjs
//
// MAX_DELAY_MS adds a random delay before submitting, so the onchain time of a
// vote is decorrelated from when the member pressed the button.
// Operators should not log request IPs; members who don't trust the operator
// should reach it over Tor.
import { createServer } from "node:http";
import { ethers } from "ethers";
import { RPC_URL, contracts, loadDeployment } from "./shared/common.mjs";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.RELAYER_KEY, provider);
const { voting } = contracts(await loadDeployment(provider), wallet);
const port = Number(process.env.PORT ?? 8787);
const maxDelay = Number(process.env.MAX_DELAY_MS ?? 0);

// Serialize sends so concurrent requests don't race on the relayer's nonce.
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

async function relay({ proposalId, nullifierHash, support, proof }) {
  const args = [BigInt(proposalId), BigInt(nullifierHash), Boolean(support), ethers.getBytes(proof)];
  // Simulate first so an invalid/duplicate proof costs the relayer nothing.
  await voting.castVote.staticCall(...args);
  if (maxDelay > 0) await new Promise((r) => setTimeout(r, Math.random() * maxDelay));
  return serial(async () => {
    const tx = await voting.castVote(...args);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
  });
}

createServer(async (req, res) => {
  const reply = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method !== "POST" || req.url !== "/vote") return reply(404, { error: "POST /vote" });
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) return reply(413, { error: "too large" });
  }
  try {
    const out = await relay(JSON.parse(raw));
    console.log(`relayed vote -> ${out.txHash}`); // deliberately no client address
    reply(200, out);
  } catch (e) {
    const reason = e.revert?.name ?? e.shortMessage ?? e.message;
    reply(400, { error: reason });
  }
}).listen(port, () => console.log(`relayer ${wallet.address} listening on :${port}`));
