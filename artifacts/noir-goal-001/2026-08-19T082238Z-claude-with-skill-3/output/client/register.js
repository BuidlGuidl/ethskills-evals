#!/usr/bin/env node
// STEP 1 of 2 for a member: join the vote.
//
//   node client/register.js --token 42 --account 3 --note client/notes/member-42.json
//
// Sent from the MEMBER'S OWN WALLET, the one holding the membership NFT. That is
// deliberate and safe: membership is already public, and this transaction publishes
// only Poseidon(secret, trapdoor). A chain observer learns "this known member joined
// the anonymous-voting scheme" -- which is not a vote, and not linkable to one.
//
// The note written at the end is the member's only key material. There is no recovery.

import { getContract } from "viem";
import { args } from "./src/args.js";
import { createIdentity, loadNote, saveNote } from "./src/identity.js";
import {
  abiOf,
  loadDeployment,
  publicClient,
  walletFor,
  anvilAccount,
  accountFromKey,
  waitFor,
} from "./src/chain.js";

export async function register({ tokenId, account, notePath, deployment }) {
  const pub = publicClient();
  const wallet = walletFor(account);
  const registryAbi = abiOf("MemberRegistry");

  // Reuse an existing note if this member already has one; otherwise mint an identity.
  const existing = loadNote(notePath);
  const identity = existing ?? (await createIdentity());
  if (existing) {
    console.log(`  reusing note at ${notePath}`);
  }

  const registry = getContract({
    address: deployment.registry,
    abi: registryAbi,
    client: { public: pub, wallet },
  });

  const hash = await registry.write.register([BigInt(tokenId), identity.commitment]);
  const receipt = await waitFor(hash, pub);

  // leafIndex comes from the event; the client needs it to build Merkle paths later.
  const [log] = await pub.getContractEvents({
    address: deployment.registry,
    abi: registryAbi,
    eventName: "MemberRegistered",
    blockHash: receipt.blockHash,
  });
  const leafIndex = Number(log.args.leafIndex);

  saveNote(notePath, {
    ...identity,
    leafIndex,
    registry: deployment.registry,
    chainId: deployment.chainId,
  });

  return { hash, leafIndex, commitment: identity.commitment, from: account.address };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  const deployment = loadDeployment();
  const account = a.key
    ? accountFromKey(a.key)
    : anvilAccount(Number(a.account ?? 1));
  const tokenId = Number(a.token ?? 0);
  const notePath = a.note ?? `client/notes/member-${tokenId}.json`;

  const r = await register({ tokenId, account, notePath, deployment });
  console.log(`registered token #${tokenId}`);
  console.log(`  from wallet   ${r.from}   <- the member's own, public, fine`);
  console.log(`  commitment    0x${r.commitment.toString(16)}`);
  console.log(`  leaf index    ${r.leafIndex}`);
  console.log(`  note saved to ${notePath}  <- lose this and you cannot ever vote`);
}
