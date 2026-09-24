// ONE-TIME enrollment of a member. Run by the member, on their own machine.
//
//   MEMBER_PRIVATE_KEY=0x... TOKEN_ID=7 node scripts/member-register.mjs [notePath]
//
// 1. Generates the member's secret identity (idNullifier, idTrapdoor) — or
//    reuses the one already in the note file.
// 2. Sends register(tokenId, commitment) FROM THE MEMBER'S NFT WALLET.
//    Observers learn: "wallet W / token T enrolled commitment C at leaf i".
//    C is a hiding hash; it is never referenced again outside a ZK proof.
// 3. Saves the note. Losing it = losing the ability to vote (re-enrolment is
//    not possible for the same token). Anyone who gets it can vote as you.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ROOT, RPC_URL, connect, votingAbi, randomField, identityCommitment } from "./lib/common.mjs";

const pk = process.env.MEMBER_PRIVATE_KEY;
const tokenId = BigInt(process.env.TOKEN_ID ?? "");
if (!pk) throw new Error("set MEMBER_PRIVATE_KEY (the wallet holding the membership NFT)");
const notePath = process.argv[2] ?? join(ROOT, "notes", `member-${tokenId}.json`);

const { chain, chainId, deployment, publicClient } = await connect();
const account = privateKeyToAccount(pk);
const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });

let note;
if (existsSync(notePath)) {
  note = JSON.parse(readFileSync(notePath, "utf8"));
  console.log(`reusing identity from ${notePath}`);
} else {
  const idNullifier = randomField();
  const idTrapdoor = randomField();
  note = {
    idNullifier: idNullifier.toString(),
    idTrapdoor: idTrapdoor.toString(),
    commitment: identityCommitment(idNullifier, idTrapdoor).toString(),
    chainId,
    voting: deployment.voting,
    tokenId: tokenId.toString(),
    memberAddress: account.address, // kept locally so the vote script can refuse to send from it
  };
  mkdirSync(dirname(notePath), { recursive: true });
  writeFileSync(notePath, JSON.stringify(note, null, 2), { mode: 0o600 }); // persist BEFORE sending the tx
}

const hash = await wallet.writeContract({
  address: deployment.voting,
  abi: votingAbi,
  functionName: "register",
  args: [tokenId, BigInt(note.commitment)],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`register reverted: ${hash}`);

const [log] = await publicClient.getContractEvents({
  address: deployment.voting,
  abi: votingAbi,
  eventName: "MemberRegistered",
  args: { tokenId },
  blockHash: receipt.blockHash,
});
note.leafIndex = Number(log.args.leafIndex);
writeFileSync(notePath, JSON.stringify(note, null, 2), { mode: 0o600 });
console.log(`registered token ${tokenId} from ${account.address} at leaf ${note.leafIndex} (tx ${hash})`);
console.log(`secret note saved to ${notePath}`);
