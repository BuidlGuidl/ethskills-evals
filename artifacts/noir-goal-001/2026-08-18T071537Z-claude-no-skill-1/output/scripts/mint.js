#!/usr/bin/env node
// Admin: issue membership seats. Sent from the DAO ADMIN WALLET.
//
// Nothing private happens here -- this is the DAO's existing, public membership
// process. Included so a local chain has members on it.
//
//   MEMBERS=0xabc...,0xdef... node scripts/mint.js

import { ANVIL_KEYS, connect, wallet } from "./lib/deployment.js";
import { Wallet } from "ethers";

const { provider, membership } = await connect();
const admin = wallet(process.env.ADMIN_KEY || ANVIL_KEYS.admin, provider);

const targets = (process.env.MEMBERS || new Wallet(ANVIL_KEYS.member).address)
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);

console.log(`admin ${admin.address} minting ${targets.length} seat(s)`);
const tx = await membership.connect(admin).mintBatch(targets);
await tx.wait();

for (const address of targets) {
  console.log(`  ${address}  holds ${await membership.balanceOf(address)} seat`);
}
console.log(`total seats: ${await membership.totalSupply()}`);
console.log(`mintBatch() tx ${tx.hash}  (sender: the DAO admin)`);
