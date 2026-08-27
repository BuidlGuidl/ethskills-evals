#!/usr/bin/env node
// STEP 1 OF 2 -- joining the vote.  Sent from the MEMBER'S OWN WALLET.
//
// This transaction is public and attributable, and that is fine: it says "this
// member holds seat #N and has published commitment C". It says nothing about
// any proposal, because no proposal is involved, and nothing about any future
// ballot, because the link from C to a ballot is exactly what the zero-knowledge
// proof breaks.
//
// Do this once, well before any proposal you care about. See NOTES.md for why
// the timing matters.
//
//   MEMBER_KEY=0x... node scripts/enroll.js        (TOKEN_ID optional)

import { commitmentOf, deriveSecret } from "./lib/member.js";
import { ANVIL_KEYS, connect, wallet } from "./lib/deployment.js";

const memberKey = process.env.MEMBER_KEY || ANVIL_KEYS.member;

const { provider, membership, memberSet } = await connect();
const member = wallet(memberKey, provider);

const tokenId = process.env.TOKEN_ID
  ? BigInt(process.env.TOKEN_ID)
  : await membership.tokenOfMember(member.address);
if (tokenId === 0n) throw new Error(`${member.address} holds no membership NFT`);

console.log(`member wallet   ${member.address}`);
console.log(`membership seat #${tokenId}`);

const owner = await membership.ownerOf(tokenId);
if (owner.toLowerCase() !== member.address.toLowerCase()) {
  throw new Error(`seat #${tokenId} is held by ${owner}, not by ${member.address}`);
}

// Derived from a signature, so the wallet is the only backup the member needs.
// This happens entirely offline -- no RPC call, nothing logged anywhere.
const secret = await deriveSecret(member);
const commitment = commitmentOf(secret);
console.log(`voting secret   (never leaves this machine)`);
console.log(`commitment      ${commitment}`);

if (await memberSet.enrolled(tokenId)) {
  const leaves = await memberSet.allLeaves();
  const index = leaves.findIndex((l) => l.toLowerCase() === commitment.toLowerCase());
  if (index < 0) {
    throw new Error(
      `seat #${tokenId} already enrolled a different commitment.\n` +
        `Enrolment is once-per-seat and permanent -- see NOTES.md, "Losing a secret".`,
    );
  }
  console.log(`already enrolled at leaf ${index}; nothing to do`);
  process.exit(0);
}

const tx = await memberSet.connect(member).enroll(tokenId, commitment);
console.log(`\nenroll() tx     ${tx.hash}   (sender: the member's own wallet)`);
const receipt = await tx.wait();
const enrolled = receipt.logs
  .map((log) => {
    try {
      return memberSet.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .find((e) => e?.name === "Enrolled");

console.log(`leaf index      ${enrolled.args.leafIndex}`);
console.log(`new set root    ${await memberSet.root()}`);
console.log(`members enrolled ${await memberSet.memberCount()}`);
console.log(`
An observer learns: ${member.address} holds seat #${tokenId} and published
commitment ${commitment}.
They do NOT learn the secret behind it, and nothing here links it to a ballot.`);
