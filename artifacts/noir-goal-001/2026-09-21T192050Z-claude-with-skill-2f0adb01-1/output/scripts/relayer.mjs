// Minimal vote relayer: accepts { proposalId, support, nullifierHash, proof } and
// submits castVote from its own funded wallet. It learns nothing about the voter
// beyond what the chain will show anyway — except the HTTP client's network
// address, which it deliberately does not log. Members who don't trust whoever runs
// it (including the DAO) should reach it over Tor, or use a different relayer:
// castVote accepts any sender.
//
//   RELAYER_PRIVATE_KEY=0x... node scripts/relayer.mjs   # listens on :8799
//   RELAY_MAX_DELAY_MS=600000  random hold before sending, so tx timing doesn't
//                              mirror when a member pressed "vote" (default 0)
import { createServer } from "node:http";
import { clients, isMain, loadAbi, loadDeployment } from "./lib/common.mjs";

export async function relay({ proposalId, support, nullifierHash, proof }, relayerKey) {
  const d = loadDeployment();
  const { publicClient, walletClient } = clients(relayerKey);
  // Simulate first: an invalid proof or spent nullifier costs the relayer nothing.
  const { request } = await publicClient.simulateContract({
    account: walletClient.account,
    address: d.anonVoting,
    abi: loadAbi("AnonVoting"),
    functionName: "castVote",
    args: [BigInt(proposalId), Boolean(support), BigInt(nullifierHash), proof],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`castVote reverted: ${hash}`);
  return hash;
}

if (isMain(import.meta.url)) {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("set RELAYER_PRIVATE_KEY");
  const maxDelay = Number(process.env.RELAY_MAX_DELAY_MS ?? 0);
  const port = Number(process.env.PORT ?? 8799);
  const host = process.env.HOST ?? "127.0.0.1";
  createServer(async (req, res) => {
    const reply = (code, body) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
    if (req.method !== "POST" || req.url !== "/vote") return reply(404, { error: "POST /vote" });
    try {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const payload = JSON.parse(raw);
      if (maxDelay > 0) await new Promise((r) => setTimeout(r, Math.random() * maxDelay));
      reply(200, { txHash: await relay(payload, key) });
    } catch (e) {
      reply(400, { error: e.shortMessage ?? e.message });
    }
  }).listen(port, host, () => console.log(`relayer listening on ${host}:${port}`));
}
