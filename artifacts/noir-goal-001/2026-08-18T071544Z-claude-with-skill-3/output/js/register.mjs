#!/usr/bin/env node
// Step 1 of the member flow: join the vote.
//
//   node js/register.mjs --member-key 0x<privkey>
//
// Sent by the member's own NFT-holding wallet. This transaction is public and
// deliberately links "wallet X" to "commitment C" — that link is what makes the
// anonymity set auditable. Nothing here reveals anything about future ballots:
// the commitment is a blinded hash and the per-proposal nullifiers derived from
// the same secret are unlinkable to it.

import { Wallet } from "ethers";
import { identityFromSigner, deriveIdentity } from "./lib/identity.mjs";
import { anonVoting, membership, loadDeployment, provider } from "./lib/contracts.mjs";
import { parseArgs } from "./lib/args.mjs";

const args = parseArgs();
const deployment = await loadDeployment();
const rpc = provider(args.rpc);

const memberKey = args["member-key"] ?? process.env.MEMBER_PRIVATE_KEY;
if (!memberKey) throw new Error("pass --member-key 0x... or set MEMBER_PRIVATE_KEY");

const member = new Wallet(memberKey, rpc);
const voting = anonVoting(deployment.anonVoting, member);
const nft = membership(deployment.membershipNFT, rpc);

if ((await nft.balanceOf(member.address)) === 0n) {
  throw new Error(`${member.address} does not hold a membership NFT`);
}
if (await voting.hasRegistered(member.address)) {
  const identity = args.secret ? deriveIdentity(args.secret) : await identityFromSigner(member);
  console.log(`${member.address} is already registered (commitment ${identity.commitment})`);
  process.exit(0);
}

// The identity is derived from a signature, so it is reproducible from the
// wallet alone — no note file to back up, no note file to leak.
const identity = args.secret ? deriveIdentity(args.secret) : await identityFromSigner(member);

console.log(`member wallet : ${member.address}`);
console.log(`commitment    : ${identity.commitment}`);
console.log("  (identity nullifier + trapdoor stay on this machine and are never sent)");

const tx = await voting.register(identity.commitment);
const receipt = await tx.wait();
const event = receipt.logs
  .map((log) => {
    try {
      return voting.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .find((parsed) => parsed?.name === "MemberRegistered");

console.log(`\nregister() tx : ${receipt.hash}  (from ${member.address})`);
console.log(`leaf index    : ${event.args.leafIndex}`);
console.log(`new tree root : ${event.args.newRoot}`);
console.log(`members joined: ${await voting.memberCount()}`);

rpc.destroy(); // stop the ethers poller so the script exits
