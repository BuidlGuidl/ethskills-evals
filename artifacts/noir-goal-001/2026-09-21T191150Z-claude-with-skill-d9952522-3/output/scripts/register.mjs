// Step 1 (member's own wallet): create a secret note and register its commitment.
//
//   MEMBER_KEY=0x... TOKEN_ID=3 NOTE=notes/me.json node scripts/register.mjs
//
// Sent from the wallet that holds the membership NFT. Public by design: the chain
// learns "the holder of token 3 registered commitment C", and C reveals nothing.
import { ethers } from "ethers";
import { existsSync } from "node:fs";
import { VOTING_ABI, loadDeployment, newNote, saveNote } from "./lib.mjs";

const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const notePath = process.env.NOTE ?? "notes/note.json";
const tokenId = BigInt(process.env.TOKEN_ID ?? "1");
if (!process.env.MEMBER_KEY) throw new Error("set MEMBER_KEY");
if (existsSync(notePath)) throw new Error(`${notePath} exists; refusing to overwrite a note`);

const provider = new ethers.JsonRpcProvider(rpc);
const wallet = new ethers.Wallet(process.env.MEMBER_KEY, provider);
const { chainId } = await provider.getNetwork();
const voting = new ethers.Contract(loadDeployment(chainId).voting, VOTING_ABI, wallet);

const note = newNote();
// Persist BEFORE sending: a registered commitment with a lost note is an unusable vote.
saveNote(notePath, { ...note, tokenId: tokenId.toString(), chainId: chainId.toString(), voting: await voting.getAddress() });

const receipt = await (await voting.register(tokenId, note.commitment)).wait();
const ev = receipt.logs.map((l) => voting.interface.parseLog(l)).find((e) => e?.name === "MemberRegistered");
saveNote(notePath, {
  ...note,
  tokenId: tokenId.toString(),
  chainId: chainId.toString(),
  voting: await voting.getAddress(),
  leafIndex: Number(ev.args.leafIndex),
});
console.log(`registered token ${tokenId} as leaf ${ev.args.leafIndex}; note saved to ${notePath}`);
