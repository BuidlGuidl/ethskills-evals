// Step 1 of the flow: a member publishes their voter commitment.
//
// SENT BY: the member's own, publicly known member wallet.
// AN OBSERVER LEARNS: that this member joined, and which leaf index they took. That is not
// a privacy loss — the commitment is a hash of two secrets and reveals nothing about any
// future ballot. Membership is public anyway. What must stay unlinkable is the *vote*
// transaction, and that one is relayed (js/vote.mjs).
//
// Usage: MEMBER_INDEX=7 node js/join.mjs
import { contracts, memberWallet } from "./lib/chain.mjs";
import { deriveNote, saveNote, loadNote } from "./lib/note.mjs";

const memberIndex = Number(process.env.MEMBER_INDEX ?? 0);

export async function join(index = memberIndex, { quiet = false } = {}) {
  const wallet = memberWallet(index);
  const { membership, registry } = contracts(wallet);

  const tokenId = await membership.tokenOf(wallet.address);
  if (tokenId === 0n) throw new Error(`${wallet.address} holds no membership badge`);

  // Secrets are derived from a signature by the member's own key, so they are recoverable
  // if the local note file is lost. They never leave this process.
  const note = loadNote(wallet.address) ?? (await deriveNote(wallet));

  if (await registry.hasJoined(tokenId)) {
    // Already joined. If the note file was lost, the secrets came back from the signature
    // above but the leaf index did not — recover it by finding our commitment in the log.
    // This is what makes "losing notes/ is not fatal" actually true.
    let leafIndex = note.leafIndex;
    if (leafIndex === null || leafIndex === undefined) {
      const [found] = await registry.queryFilter(registry.filters.CommitmentAdded(), 0, "latest")
        .then((logs) => logs.filter((l) => l.args.commitment === note.commitment));
      if (!found) throw new Error(`badge ${tokenId} has joined, but with a different commitment`);
      leafIndex = Number(found.args.leafIndex);
      saveNote(wallet.address, { ...note, leafIndex });
    }
    if (!quiet) console.log(`member ${index} already joined at leaf ${leafIndex}`);
    return { ...note, leafIndex };
  }

  const tx = await registry.join(tokenId, note.commitment);
  const receipt = await tx.wait();

  const event = receipt.logs
    .map((l) => { try { return registry.interface.parseLog(l); } catch { return null; } })
    .find((l) => l?.name === "CommitmentAdded");

  const joined = { ...note, leafIndex: Number(event.args.leafIndex) };
  saveNote(wallet.address, joined);

  if (!quiet) {
    console.log(`member ${index} (${wallet.address}) joined`);
    console.log(`  tx          ${receipt.hash}   <- sent by the member's own wallet`);
    console.log(`  commitment  0x${note.commitment.toString(16)}`);
    console.log(`  leafIndex   ${joined.leafIndex}`);
    console.log(`  new root    ${event.args.root}`);
  }
  return joined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  join().catch((e) => { console.error(e.message ?? e); process.exit(1); });
}
