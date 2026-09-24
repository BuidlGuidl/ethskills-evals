#!/usr/bin/env node
// Minimal vote relayer. Pays gas for castVote so members never touch the chain
// from a wallet linked to them. It learns nothing a chain observer doesn't,
// except network metadata (IP, timing) of whoever posts to it, so it keeps no
// logs, and members should reach it over Tor or a VPN.
// It cannot alter a vote: vote and nullifier are public inputs of the proof.
//
//   RELAYER_PRIVATE_KEY=0x.. PORT=8787 node js/relayer.mjs
import { createServer } from "node:http";
import { ethers } from "ethers";
import { connect, rpcUrl } from "./common/contracts.mjs";

export async function startRelayer({ wallet, port = 8787 }) {
  const { voting, nft } = await connect(wallet);
  if ((await nft.balanceOf(wallet.address)) > 0n) throw new Error("relayer wallet must not hold a membership NFT");

  // Send one tx at a time so nonces never collide.
  let queue = Promise.resolve();

  const server = createServer((req, res) => {
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
    req.on("end", () => {
      queue = queue.then(async () => {
        try {
          const { proposalId, support, nullifier, proof } = JSON.parse(raw);
          if (typeof support !== "boolean" || !ethers.isHexString(proof)) throw new Error("bad payload");
          const args = [BigInt(proposalId), support, BigInt(nullifier), proof];
          // Simulate first: invalid proofs / used nullifiers cost the relayer nothing.
          await voting.castVote.staticCall(...args);
          const tx = await voting.castVote(...args);
          await tx.wait();
          reply(200, { txHash: tx.hash });
        } catch (e) {
          let msg = e.shortMessage ?? e.message;
          try {
            if (e.data) msg = voting.interface.parseError(e.data)?.name ?? msg;
          } catch {}
          reply(400, { error: msg });
        }
      });
    });
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.RELAYER_PRIVATE_KEY) {
    console.error("usage: RELAYER_PRIVATE_KEY=0x.. [PORT=8787] node js/relayer.mjs");
    process.exit(1);
  }
  const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, new ethers.JsonRpcProvider(rpcUrl()));
  const port = Number(process.env.PORT ?? 8787);
  await startRelayer({ wallet, port });
  console.log(`relayer ${wallet.address} listening on http://127.0.0.1:${port}/vote`);
}
