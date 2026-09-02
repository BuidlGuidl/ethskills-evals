/**
 * Step 1 — members join the vote.
 *
 * Each member sends this transaction themselves, from the wallet that holds their membership NFT.
 * It is fully attributable and that is fine: what goes onchain is a Poseidon commitment, and a
 * commitment tells an observer nothing except that this member is now inside the anonymity set.
 * Every member should register, including ones who plan to abstain — a member who skips this step
 * shrinks the crowd everyone else hides in.
 *
 *   npm run register              # all 150 demo members
 *   npm run register -- --member 7
 */
import { identityFromSeed, identityFromWallet } from "./lib/identity.mjs";
import { connect, accountAt, provider } from "./lib/deployment.mjs";
import { toHex32 } from "./lib/field.mjs";
import { MEMBER_COUNT, memberAccountIndex, demoSeed } from "./demo-members.mjs";

const args = process.argv.slice(2);
const only = args.includes("--member") ? Number(args[args.indexOf("--member") + 1]) : null;
const useWalletSignature = args.includes("--sign");

const p = provider();
const targets = only === null ? [...Array(MEMBER_COUNT).keys()] : [only];

/** One member's registration, sent from that member's own wallet. */
async function registerMember(i) {
  const wallet = accountAt(memberAccountIndex(i), p);
  const { registry, nft } = connect(wallet);

  // Real deployments should use `identityFromWallet` — the member signs a fixed message and the
  // signature seeds their identity, so there is no separate secret to lose. The demo default is a
  // reproducible passphrase so this script and the Foundry fixture agree; see demo-members.mjs.
  const identity = useWalletSignature ? await identityFromWallet(wallet) : identityFromSeed(demoSeed(i));

  const tokenId = i + 1;
  if (await registry.tokenIdRegistered(tokenId)) return "skipped";
  if ((await nft.ownerOf(tokenId)) !== wallet.address) {
    throw new Error(`member ${i} does not hold NFT ${tokenId} — did Deploy.s.sol run?`);
  }

  // Explicit gas limit, not estimation. These transactions are prepared as a batch against the
  // same pre-batch state, but a LeanIMT insert that grows the tree's depth costs materially more
  // than one that does not — so an estimate taken before the batch lands is too low for the
  // inserts at the back of it, and they revert out of gas.
  const tx = await registry.register(tokenId, toHex32(identity.commitment), { gasLimit: 500_000 });
  await tx.wait();
  if (only !== null) console.log(`  member ${i} -> commitment ${toHex32(identity.commitment)} (tx ${tx.hash})`);
  return "registered";
}

// Each member has their own wallet and their own nonce, so these are independent transactions and
// can go out together. Onchain they still land in whatever order the mempool decides — which is
// also true in production, and is exactly why leaf indices come from the event log rather than
// from anything the client assumed.
const results = [];
const BATCH = 50;
for (let start = 0; start < targets.length; start += BATCH) {
  const batch = targets.slice(start, start + BATCH);
  results.push(...(await Promise.all(batch.map(registerMember))));
  if (targets.length > 1) console.log(`  ...${Math.min(start + BATCH, targets.length)}/${targets.length} registered`);
}

const registered = results.filter((r) => r === "registered").length;
const alreadyDone = results.length - registered;

const { registry } = connect(p);
console.log(
  `registered ${registered}, already present ${alreadyDone}; ` +
    `tree size ${await registry.size()}, depth ${await registry.depth()}, root ${toHex32(await registry.root())}`,
);
