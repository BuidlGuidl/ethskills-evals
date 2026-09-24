// Shared helpers for the member and relayer scripts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { poseidon1, poseidon2 } from 'poseidon-lite'; // circomlib Poseidon with 1 / 2 inputs

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEPTH = 10; // must match circuits/vote and MemberGroup.DEPTH
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const GROUP_ABI = [
  'function register(uint256 tokenId, uint256 commitment) returns (uint256)',
  'function size() view returns (uint256)',
  'function root() view returns (uint256)',
  'event MemberRegistered(uint256 indexed tokenId, uint256 indexed leafIndex, uint256 commitment, uint256 root)',
];
export const VOTING_ABI = [
  'function proposals(uint256) view returns (uint256 root, uint256 scope, uint64 deadline, uint32 eligible, uint32 yes, uint32 no)',
  'function nullifierUsed(uint256, uint256) view returns (bool)',
  'function castVote(uint256 proposalId, bool support, uint256 nullifier, bytes proof)',
  'function tally(uint256) view returns (uint256 yes, uint256 no, uint256 eligible)',
  'error InvalidProof()', 'error AlreadyVoted()', 'error VotingClosed()', 'error UnknownProposal()', 'error InvalidNullifier()',
];

export function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`missing env ${name}`);
  return v;
}

export async function connect() {
  const provider = new ethers.JsonRpcProvider(env('RPC_URL', 'http://127.0.0.1:8545'));
  const { chainId } = await provider.getNetwork();
  const file = process.env.DEPLOYMENT ?? path.join(ROOT, 'deployments', `${chainId}.json`);
  const deployment = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { provider, deployment };
}

// ---- identity -------------------------------------------------------------

/** A fresh identity secret: 31 random bytes, so always a valid field element. */
export function newSecret() {
  return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
}
export const commitmentOf = (secret) => poseidon1([secret]);
export const nullifierOf = (secret, scope) => poseidon2([secret, scope]);

export function loadSecret(file) {
  return BigInt(JSON.parse(fs.readFileSync(file, 'utf8')).secret);
}
export function saveSecret(file, secret) {
  fs.writeFileSync(file, JSON.stringify({ secret: '0x' + secret.toString(16) }) + '\n', { mode: 0o600, flag: 'wx' });
}

// ---- member tree ----------------------------------------------------------

/** Rebuilds the member tree from MemberRegistered events (no trust in the DAO's site). */
export async function fetchLeaves(group, fromBlock) {
  const logs = await group.queryFilter(group.filters.MemberRegistered(), fromBlock);
  const leaves = [];
  for (const l of logs) leaves[Number(l.args.leafIndex)] = l.args.commitment;
  return leaves;
}

/** Merkle root + sibling path for `index` over `leaves` (zero-padded to 2^DEPTH). */
export function merklePath(leaves, index) {
  const zeros = [0n];
  for (let i = 1; i <= DEPTH; i++) zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));
  let level = leaves.slice();
  let idx = index;
  const siblings = [];
  for (let d = 0; d < DEPTH; d++) {
    const sib = idx ^ 1;
    siblings.push(sib < level.length ? level[sib] : zeros[d]);
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(poseidon2([level[i], i + 1 < level.length ? level[i + 1] : zeros[d]]));
    }
    level = next;
    idx >>= 1;
  }
  return { root: level.length ? level[0] : zeros[DEPTH], siblings };
}

export const hex32 = (x) => ethers.toBeHex(x, 32);
