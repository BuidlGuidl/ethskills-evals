#!/usr/bin/env node
// Member joins the vote set. Sent FROM THE MEMBER'S NFT WALLET; this is the one
// transaction that is supposed to be attributable to them.
//   MEMBER_PRIVATE_KEY=0x.. node js/register.mjs --identity <file> --token <tokenId>
import { parseArgs } from "node:util";
import { ethers } from "ethers";
import { connect, rpcUrl } from "./common/contracts.mjs";
import { loadIdentity } from "./common/identity.mjs";

export async function register({ memberWallet, identityFile, tokenId }) {
  const { voting } = await connect(memberWallet);
  const { commitment } = loadIdentity(identityFile);
  const tx = await voting.register(tokenId, commitment);
  const rcpt = await tx.wait();
  const ev = rcpt.logs.map((l) => voting.interface.parseLog(l)).find((e) => e?.name === "MemberRegistered");
  return { txHash: tx.hash, leafIndex: Number(ev.args.leafIndex), commitment };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { identity: { type: "string" }, token: { type: "string" } } });
  if (!values.identity || !values.token || !process.env.MEMBER_PRIVATE_KEY) {
    console.error("usage: MEMBER_PRIVATE_KEY=0x.. node js/register.mjs --identity <file> --token <tokenId>");
    process.exit(1);
  }
  const memberWallet = new ethers.Wallet(process.env.MEMBER_PRIVATE_KEY, new ethers.JsonRpcProvider(rpcUrl()));
  const r = await register({ memberWallet, identityFile: values.identity, tokenId: BigInt(values.token) });
  console.log(`registered token ${values.token} as leaf ${r.leafIndex} (tx ${r.txHash})`);
}
