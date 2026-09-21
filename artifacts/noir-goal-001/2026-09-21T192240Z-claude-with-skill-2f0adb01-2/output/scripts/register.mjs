// Step 1 — JOIN (once per member, reused for every future proposal).
// Sent by the member's PUBLIC wallet, the one holding the membership NFT.
//
//   MEMBER_KEY=0x... TOKEN_ID=1 node scripts/register.mjs
//
// Creates a fresh random note, stores it in .notes/member-<tokenId>.json, and
// inserts only its commitment onchain.
import { clients, loadDeployment, requireEnv, votingAbi } from "./lib/chain.mjs";
import { commitmentOf, newIdentity, saveNote } from "./lib/identity.mjs";
import { parseEventLogs } from "viem";

const tokenId = BigInt(requireEnv("TOKEN_ID"));
const { chainId, publicClient, walletClient } = await clients(requireEnv("MEMBER_KEY"));
const dep = loadDeployment(chainId);

const identity = newIdentity();
const commitment = commitmentOf(identity);

const hash = await walletClient.writeContract({
  address: dep.voting, abi: votingAbi, functionName: "register", args: [tokenId, commitment],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("register reverted");
const [ev] = parseEventLogs({ abi: votingAbi, logs: receipt.logs, eventName: "MemberRegistered" });

const file = saveNote({
  ...identity, commitment, tokenId: tokenId.toString(), chainId, voting: dep.voting,
  leafIndex: Number(ev.args.leafIndex),
});
console.log(`registered token #${tokenId} at leaf ${ev.args.leafIndex} (tx ${hash})`);
console.log(`note saved to ${file} — back it up; it is your ballot key`);
