// Vote relayer: submits castVote() from its OWN wallet so voters' wallets never
// touch the vote transaction. It learns only what the chain will learn anyway
// (proposal, yes/no, nullifier hash) plus network metadata of the request —
// which is why members should reach it over Tor and why several independent
// relayers (any member can run one) are better than one.
//
//   RELAYER_KEY=0x... PORT=8787 RELAY_MAX_DELAY_MS=0 node scripts/relayer.mjs
//
// RELAY_MAX_DELAY_MS adds a random delay before broadcast so the vote's
// block time doesn't reveal when the member pressed "vote".
import http from "node:http";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { clients, loadDeployment, requireEnv, votingAbi } from "./lib/chain.mjs";

const { chainId, publicClient, walletClient } = await clients(requireEnv("RELAYER_KEY"));
const dep = loadDeployment(chainId);
const port = Number(process.env.PORT ?? 8787);
const maxDelay = Number(process.env.RELAY_MAX_DELAY_MS ?? 0);

async function relay({ proposalId, support, nullifierHash, proof }) {
  const args = [BigInt(proposalId), Boolean(support), BigInt(nullifierHash), proof];
  // Simulate first: an invalid proof / double vote costs the relayer nothing.
  const { request } = await publicClient.simulateContract({
    address: dep.voting, abi: votingAbi, functionName: "castVote", args, account: walletClient.account,
  });
  if (maxDelay > 0) await new Promise((r) => setTimeout(r, Math.floor(Math.random() * maxDelay)));
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("castVote reverted");
  return hash;
}

http.createServer(async (req, res) => {
  const reply = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (req.method !== "POST" || req.url !== "/vote") return reply(404, { error: "POST /vote" });
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64_000) return reply(413, { error: "too large" });
  }
  try {
    const txHash = await relay(JSON.parse(body));
    reply(200, { txHash }); // deliberately no request logging (no IPs, no timing)
  } catch (e) {
    const revert = e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError);
    reply(400, { error: revert?.data?.errorName ?? e.shortMessage ?? e.message });
  }
}).listen(port, () => console.log(`relayer ${walletClient.account.address} on :${port} for ${dep.voting}`));
