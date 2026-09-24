// Step 1 (once per member, not per proposal): create a secret note and publish its
// commitment from the member's NFT wallet.
//
//   MEMBER_PRIVATE_KEY=0x... node scripts/register.mjs --token-id 1
//
// Public after this tx: "wallet W (holder of token #1) registered commitment C".
// That is intended — C is a hiding commitment and no vote ever mentions it.
import { existsSync } from "node:fs";
import { arg, clients, isMain, loadAbi, loadDeployment, loadNote, newNote, notePath, saveNote } from "./lib/common.mjs";

export async function register({ memberKey, tokenId }) {
  const d = loadDeployment();
  const { publicClient, walletClient } = clients(memberKey);
  const abi = loadAbi("AnonVoting");

  // Never overwrite an existing note: losing it means losing the vote.
  const file = notePath(tokenId);
  let note;
  if (existsSync(file)) {
    note = loadNote(file);
  } else {
    note = newNote({ chainId: d.chainId, contract: d.anonVoting, tokenId });
    saveNote(note); // persist BEFORE sending the tx
    note = loadNote(file);
  }

  const onchain = await publicClient.readContract({ address: d.anonVoting, abi, functionName: "commitmentOf", args: [BigInt(tokenId)] });
  if (onchain === note.commitment) {
    console.log(`token #${tokenId} already registered with this note (${file})`);
    return note;
  }
  if (onchain !== 0n) throw new Error(`token #${tokenId} is registered with a different commitment; use replaceCommitment`);

  const { request } = await publicClient.simulateContract({
    account: walletClient.account,
    address: d.anonVoting,
    abi,
    functionName: "register",
    args: [BigInt(tokenId), note.commitment],
  });
  const hash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`registered token #${tokenId} from ${walletClient.account.address}; note saved to ${file}`);
  return note;
}

if (isMain(import.meta.url)) {
  await register({ memberKey: process.env.MEMBER_PRIVATE_KEY, tokenId: arg("token-id") });
}
