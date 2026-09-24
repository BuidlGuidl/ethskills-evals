// Step 1 (once per member, not per proposal): publish an identity commitment.
//
// Sent FROM THE MEMBER'S NFT WALLET. This is public and intended: it says
// "the holder of token T has identity commitment C". C = H(secret) reveals nothing
// about future votes.
//
//   MEMBER_PRIVATE_KEY=0x.. TOKEN_ID=1 node scripts/register.mjs
import { ethers } from "ethers";
import { connect, env, loadSecret, commitmentOf } from "./lib.mjs";

const ctx = await connect();
const member = new ethers.Wallet(env("MEMBER_PRIVATE_KEY"), ctx.provider);
const tokenId = BigInt(env("TOKEN_ID"));

const owner = await ctx.nft.ownerOf(tokenId);
if (owner !== member.address) throw new Error(`token ${tokenId} is held by ${owner}, not ${member.address}`);

const secret = await loadSecret({ dep: ctx.dep, memberWallet: member });
const commitment = commitmentOf(secret);

const tx = await ctx.registry.connect(member).register(tokenId, commitment);
const rcpt = await tx.wait();
console.log(`registered token ${tokenId} from ${member.address}`);
console.log(`  commitment ${ethers.toBeHex(commitment, 32)}`);
console.log(`  tx ${rcpt.hash} (block ${rcpt.blockNumber}, gas ${rcpt.gasUsed})`);
