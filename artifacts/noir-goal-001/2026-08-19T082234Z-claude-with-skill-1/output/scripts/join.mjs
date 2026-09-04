#!/usr/bin/env node
/**
 * STEP 1 — a member joins the anonymity set.
 *
 *   node scripts/join.mjs <memberIndex>
 *
 * Generates the member's identity locally, saves the note, and sends
 * `MemberRegistry.join(commitment)` FROM THE MEMBER'S OWN WALLET.
 *
 * That linkage is intentional. Membership is already public — the roster is on
 * the DAO's website and the NFT is in a known wallet — and the registry has to
 * check the NFT, so it must see the member. What a chain observer learns from
 * this transaction is "0xMember is now in the anonymity set", which they knew.
 * What they do not learn is any preimage of the commitment, and it is the
 * preimage, not the wallet, that later casts a ballot.
 */
import { contracts, walletAt } from "./client/env.mjs";
import { createIdentity, saveNote, noteExists, loadNote } from "./client/identity.mjs";
import { toHex32 } from "./client/poseidon.mjs";

const memberIndex = Number(process.argv[2] ?? 1);
const label = `member-${memberIndex}`;

const wallet = walletAt(memberIndex);
const { registry, membership, deployment } = contracts(wallet);

if ((await membership.balanceOf(wallet.address)) === 0n) {
  throw new Error(`${wallet.address} holds no membership NFT — it cannot join`);
}
if (await registry.hasJoined(wallet.address)) {
  console.log(`${label} (${wallet.address}) already joined; note: notes/${label}.json`);
  process.exit(0);
}

const note = noteExists(label) ? loadNote(label) : createIdentity();

console.log(`member wallet : ${wallet.address}`);
console.log(`commitment    : ${toHex32(note.commitment)}   (= Poseidon(secret, nullifierSecret))`);

const tx = await registry.join(note.commitment);
const receipt = await tx.wait();

const joined = receipt.logs
  .map((l) => {
    try {
      return registry.interface.parseLog(l);
    } catch {
      return null;
    }
  })
  .find((e) => e?.name === "MemberJoined");

const leafIndex = Number(joined.args.leafIndex);
const path = saveNote(label, {
  label,
  chainId: Number(deployment.chainId),
  registry: deployment.memberRegistry,
  secret: note.secret,
  nullifierSecret: note.nullifierSecret,
  commitment: note.commitment,
  // Convenience only. vote.mjs re-derives the index from MemberJoined logs
  // rather than trusting this, so a stale note cannot produce a bad path.
  leafIndex,
});

console.log(`tx            : ${receipt.hash}  (sent by the member's own wallet)`);
console.log(`leaf index    : ${leafIndex}`);
console.log(`new root      : ${toHex32(joined.args.newRoot)}`);
console.log(`note saved    : ${path}   <-- lose this and the member cannot vote, ever`);
