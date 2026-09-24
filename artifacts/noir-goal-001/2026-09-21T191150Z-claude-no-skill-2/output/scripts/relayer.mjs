// Minimal vote relayer: accepts {proposalId, support, nullifier, proof} over HTTP
// and submits castVote from its own funded wallet, so no member wallet ever
// sends a vote transaction. Anyone can run one; members can pick any relayer
// because the proof, not the sender, is what the contract checks.
//
//   RELAYER_PRIVATE_KEY=0x.. node scripts/relayer.mjs      (listens on PORT, default 8546)
//
// Deliberately logs nothing about requesters (no IPs, no timestamps per request).
import http from 'node:http';
import { ethers } from 'ethers';
import { VOTING_ABI, FIELD, env, connect } from './lib.mjs';

const { provider, deployment } = await connect();
const wallet = new ethers.Wallet(env('RELAYER_PRIVATE_KEY'), provider);
const voting = new ethers.Contract(deployment.anonymousVoting, VOTING_ABI, wallet);
const port = Number(env('PORT', '8546'));

async function relay(body) {
  const proposalId = BigInt(body.proposalId);
  const nullifier = BigInt(body.nullifier);
  if (typeof body.support !== 'boolean' || nullifier >= FIELD || !ethers.isHexString(body.proof)) {
    throw new Error('malformed request');
  }
  // Simulate first so an invalid proof costs the relayer nothing.
  await voting.castVote.staticCall(proposalId, body.support, nullifier, body.proof);
  const tx = await voting.castVote(proposalId, body.support, nullifier, body.proof);
  await tx.wait();
  return tx.hash;
}

// Votes are serialised so the relayer's nonce handling stays trivial.
let queue = Promise.resolve();

http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/vote') {
    res.writeHead(404).end();
    return;
  }
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 100_000) req.destroy(); });
  req.on('end', () => {
    queue = queue.then(async () => {
      try {
        const txHash = await relay(JSON.parse(data));
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ txHash, relayer: wallet.address }));
      } catch (e) {
        const reason = e.revert?.name ?? e.shortMessage ?? e.message;
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: reason }));
      }
    });
  });
}).listen(port, () => console.log(`relayer ${wallet.address} listening on :${port}`));
