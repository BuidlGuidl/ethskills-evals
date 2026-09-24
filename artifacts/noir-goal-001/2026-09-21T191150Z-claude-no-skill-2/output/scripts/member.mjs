// What one member runs. Two commands:
//
//   join  — one time. Creates the member's identity secret locally and
//           registers Poseidon(secret) from the wallet that holds their NFT.
//   vote  — per proposal. Builds a ZK proof offline and hands it to a relayer.
//           The member's own wallet is NOT used and never touches the chain.
//
//   MEMBER_PRIVATE_KEY=0x.. node scripts/member.mjs join --token-id 3 [--secret-file f]
//   node scripts/member.mjs vote --proposal 1 --yes|--no [--secret-file f] [--relayer URL]
//
// Env: RPC_URL (default http://127.0.0.1:8545), DEPLOYMENT (default deployments/<chainId>.json)
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ethers } from 'ethers';
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import {
  ROOT, DEPTH, FIELD, GROUP_ABI, VOTING_ABI, env, connect, newSecret, commitmentOf, nullifierOf,
  loadSecret, saveSecret, fetchLeaves, merklePath, hex32,
} from './lib.mjs';

const { positionals, values: opts } = parseArgs({
  allowPositionals: true,
  options: {
    'token-id': { type: 'string' },
    'secret-file': { type: 'string', default: path.join(ROOT, '.member-secret.json') },
    proposal: { type: 'string' },
    yes: { type: 'boolean' },
    no: { type: 'boolean' },
    relayer: { type: 'string', default: process.env.RELAYER_URL ?? 'http://127.0.0.1:8546' },
  },
});

async function join() {
  const { provider, deployment } = await connect();
  const wallet = new ethers.Wallet(env('MEMBER_PRIVATE_KEY'), provider);
  const tokenId = BigInt(opts['token-id'] ?? env('TOKEN_ID'));

  // The secret never leaves this machine. Anyone holding it can vote as this
  // member and can link this member's past and future nullifiers — back it up
  // like a wallet key and never send it to the DAO.
  if (!fs.existsSync(opts['secret-file'])) saveSecret(opts['secret-file'], newSecret());
  const secret = loadSecret(opts['secret-file']);
  const commitment = commitmentOf(secret);

  const group = new ethers.Contract(deployment.memberGroup, GROUP_ABI, wallet);
  // Tx #1 — sent by the member's NFT wallet. Public: "token N joined with commitment C".
  const tx = await group.register(tokenId, commitment);
  const rc = await tx.wait();
  const ev = rc.logs.map((l) => group.interface.parseLog(l)).find((e) => e?.name === 'MemberRegistered');
  console.log(`joined: token ${tokenId} -> leaf ${ev.args.leafIndex}, commitment ${hex32(commitment)} (tx ${rc.hash})`);
}

async function vote() {
  if (!!opts.yes === !!opts.no) throw new Error('pass exactly one of --yes / --no');
  const support = !!opts.yes;
  const proposalId = BigInt(opts.proposal ?? env('PROPOSAL_ID'));
  const secret = loadSecret(opts['secret-file']);

  // Everything below is read-only; reads can go through any RPC (ideally your
  // own node — a third-party RPC sees which proposal you query, and from where).
  const { provider, deployment } = await connect();
  const group = new ethers.Contract(deployment.memberGroup, GROUP_ABI, provider);
  const voting = new ethers.Contract(deployment.anonymousVoting, VOTING_ABI, provider);

  const p = await voting.proposals(proposalId);
  if (p.deadline === 0n) throw new Error(`no proposal ${proposalId}`);

  // Rebuild the tree exactly as it was when the proposal froze its root.
  const leaves = (await fetchLeaves(group, deployment.deployBlock)).slice(0, Number(p.eligible));
  const commitment = commitmentOf(secret);
  const leafIndex = leaves.findIndex((c) => c === commitment);
  if (leafIndex < 0) throw new Error('your commitment was not registered before this proposal opened');
  const { root, siblings } = merklePath(leaves, leafIndex);
  if (root !== p.root) throw new Error('rebuilt member tree does not match the proposal root');

  const nullifier = nullifierOf(secret, p.scope);
  if (await voting.nullifierUsed(proposalId, nullifier)) throw new Error('already voted on this proposal');

  // Proof generation is fully local.
  const circuit = JSON.parse(fs.readFileSync(path.join(ROOT, 'circuits/vote/target/vote.json'), 'utf8'));
  const noir = new Noir(circuit);
  const { witness } = await noir.execute({
    identity_secret: hex32(secret),
    leaf_index: leafIndex,
    siblings: siblings.map(hex32),
    root: hex32(root),
    scope: hex32(p.scope),
    vote: support ? '0x1' : '0x0',
    nullifier: hex32(nullifier),
  });
  const bb = await Barretenberg.new();
  let proof, publicInputs;
  try {
    const backend = new UltraHonkBackend(circuit.bytecode, bb);
    // 'evm' = keccak transcript (what HonkVerifier.sol checks) + zero-knowledge.
    ({ proof, publicInputs } = await backend.generateProof(witness, { verifierTarget: 'evm' }));
  } finally {
    await bb.destroy();
  }
  const expected = [root, p.scope, support ? 1n : 0n, nullifier];
  if (publicInputs.length !== 4 || publicInputs.some((x, i) => BigInt(x) !== expected[i])) {
    throw new Error('public inputs mismatch');
  }
  console.log(`proof generated (${proof.length} bytes); nullifier ${hex32(nullifier)}`);

  // Tx #3 — NOT sent by the member. The proof goes to a relayer, which pays gas.
  // The payload contains only public values; the relayer cannot alter the vote.
  // Reach the relayer over Tor / a shared VPN if you don't want it to see your IP.
  const body = { proposalId: proposalId.toString(), support, nullifier: nullifier.toString(), proof: ethers.hexlify(proof) };
  const res = await fetch(new URL('/vote', opts.relayer), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(`relayer rejected vote: ${out.error}`);
  console.log(`vote submitted by relayer ${out.relayer} in tx ${out.txHash}`);
}

const commands = { join, vote };
const cmd = commands[positionals[0]];
if (!cmd) {
  console.error('usage: node scripts/member.mjs join|vote [options]');
  process.exit(1);
}
try {
  await cmd();
} catch (e) {
  console.error(`error: ${e.shortMessage ?? e.message}`);
  process.exit(1);
}
