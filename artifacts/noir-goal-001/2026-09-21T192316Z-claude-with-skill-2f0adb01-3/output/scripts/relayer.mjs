// Minimal ballot relayer. Whoever runs it (the DAO, or any third party) pays
// gas for castVote so members never need to send a transaction for a vote.
//
//   RELAYER_PRIVATE_KEY=0x... PORT=8788 node scripts/relayer.mjs
//
// What the relayer can and cannot do:
//  - it sees the ballot (proposal, vote, nullifier, proof) moments before the
//    chain does — nothing more; the ballot contains no identity;
//  - it cannot change the vote or reuse the proof on another proposal: both
//    are public inputs bound by the proof;
//  - it CAN see the HTTP client's IP address. This process does not log it,
//    but members must not rely on that: connect over Tor/VPN;
//  - it can censor. Members can use another relayer or SENDER_PRIVATE_KEY.
// The relayer wallet must not hold a membership NFT or be any member's wallet.
import { createServer } from "node:http";
import { createWalletClient, http, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URL, connect, votingAbi } from "./lib/common.mjs";

const pk = process.env.RELAYER_PRIVATE_KEY;
if (!pk) throw new Error("set RELAYER_PRIVATE_KEY");
const port = Number(process.env.PORT ?? 8788);
// Optional random hold (ms) before submitting, so the onchain ballot time is
// not the moment the member pressed "vote". Most useful with many voters.
const jitterMs = Number(process.env.RELAY_JITTER_MS ?? 0);

const { chain, deployment, publicClient } = await connect();
const account = privateKeyToAccount(pk);
const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });

async function relay({ proposalId, support, nullifierHash, proof }) {
  if (typeof support !== "boolean" || !isHex(nullifierHash, { strict: true }) || !isHex(proof, { strict: true })) {
    throw new Error("malformed ballot");
  }
  if (jitterMs > 0) await new Promise((r) => setTimeout(r, Math.random() * jitterMs));
  // Simulate first so the relayer never pays for a reverting ballot
  // (bad proof, closed proposal, or AlreadyVoted for a reused nullifier).
  const { request } = await publicClient.simulateContract({
    account, address: deployment.voting, abi: votingAbi, functionName: "castVote",
    args: [BigInt(proposalId), support, nullifierHash, proof],
  });
  const hash = await wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`castVote reverted: ${hash}`);
  return hash;
}

createServer((req, res) => {
  const reply = (code, body) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST" || req.url !== "/vote") return reply(404, { error: "POST /vote" });
  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 100_000) req.destroy();
  });
  req.on("end", async () => {
    try {
      const txHash = await relay(JSON.parse(raw));
      console.log(`relayed ballot: ${txHash}`); // deliberately no client address / timing detail
      reply(200, { txHash });
    } catch (e) {
      const revert = e.walk?.((x) => x.data?.errorName)?.data?.errorName; // e.g. AlreadyVoted
      reply(400, { error: revert ?? e.shortMessage ?? e.message });
    }
  });
}).listen(port, "127.0.0.1", () => console.log(`relayer ${account.address} listening on :${port}`));
