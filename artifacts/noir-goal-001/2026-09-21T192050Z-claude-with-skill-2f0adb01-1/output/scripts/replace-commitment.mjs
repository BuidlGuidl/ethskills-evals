// Rotate a seat's commitment — new NFT holder after a transfer, or a member who lost
// (or leaked) their note. Sent by the wallet currently holding the NFT. Affects only
// proposals created afterwards.
//   MEMBER_PRIVATE_KEY=0x... node scripts/replace-commitment.mjs --token-id 2
import { renameSync, existsSync } from "node:fs";
import { arg, clients, currentMemberTree, isMain, loadAbi, loadDeployment, loadNote, newNote, notePath, saveNote } from "./lib/common.mjs";

export async function replaceCommitment({ memberKey, tokenId }) {
  const d = loadDeployment();
  const { publicClient, walletClient } = clients(memberKey);
  const abi = loadAbi("AnonVoting");
  const old = await publicClient.readContract({ address: d.anonVoting, abi, functionName: "commitmentOf", args: [BigInt(tokenId)] });
  if (old === 0n) throw new Error(`token #${tokenId} is not registered; use register.mjs`);

  const tree = await currentMemberTree(publicClient, d);
  const { siblings } = tree.generateProof(tree.indexOf(old));

  const file = notePath(tokenId);
  if (existsSync(file)) renameSync(file, `${file}.replaced-${Date.now()}`);
  saveNote(newNote({ chainId: d.chainId, contract: d.anonVoting, tokenId }));
  const note = loadNote(file);

  const { request } = await publicClient.simulateContract({
    account: walletClient.account, address: d.anonVoting, abi,
    functionName: "replaceCommitment", args: [BigInt(tokenId), note.commitment, siblings],
  });
  const hash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`token #${tokenId}: commitment replaced; new note at ${file}`);
  return note;
}

if (isMain(import.meta.url)) {
  await replaceCommitment({ memberKey: process.env.MEMBER_PRIVATE_KEY, tokenId: arg("token-id") });
}
