// Step 1 — join. Run by the member, ONCE, from the wallet that holds their membership NFT.
//
//   MEMBER_KEY=0x... TOKEN_ID=1 node scripts/register.mjs
//
// Generates the member's note (nullifier, secret), registers
// commitment = Poseidon(nullifier, secret) onchain, and saves the note to
// notes/<chainId>-<tokenId>.json. That file is the member's voting key for every
// future proposal: keep it private and backed up. Losing it means re-registering
// (allowed; applies to proposals opened afterwards). Leaking it lets someone vote
// as you — and if it leaks together with the chain history, your past votes are
// attributable (nullifier hashes are recomputable from it).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import { poseidon2 } from "poseidon-lite";
import { ROOT, RPC_URL, contracts, loadDeployment, randomField, toHex32 } from "./shared/common.mjs";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.MEMBER_KEY, provider);
const tokenId = BigInt(process.env.TOKEN_ID);
const dep = await loadDeployment(provider);
const { registry } = contracts(dep, wallet);

const nullifier = randomField();
const secret = randomField();
const commitment = poseidon2([nullifier, secret]);

// Write the note BEFORE sending, so a crash after the tx can't lose the secret.
const dir = join(ROOT, "notes");
mkdirSync(dir, { recursive: true });
const file = join(dir, `${dep.chainId}-${tokenId}.json`);
const note = { chainId: dep.chainId, registry: dep.registry, tokenId: tokenId.toString(),
  nullifier: toHex32(nullifier), secret: toHex32(secret), commitment: toHex32(commitment) };
writeFileSync(file, JSON.stringify(note, null, 2), { mode: 0o600 });

const tx = await registry.register(tokenId, commitment);
const receipt = await tx.wait();
const ev = receipt.logs.map((l) => registry.interface.parseLog(l)).find((e) => e?.name === "LeafSet");
note.leafIndex = Number(ev.args.leafIndex);
writeFileSync(file, JSON.stringify(note, null, 2), { mode: 0o600 });

console.log(`registered token ${tokenId} from ${wallet.address} at leaf ${note.leafIndex}`);
console.log(`note saved to ${file} — keep it secret`);
