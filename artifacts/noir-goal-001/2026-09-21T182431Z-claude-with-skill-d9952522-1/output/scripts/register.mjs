// Step 1 (once per member, reused for every proposal): join the anonymity set.
// Sent FROM THE MEMBER'S OWN WALLET — it has to prove NFT ownership, and membership
// is public anyway. It reveals only "token #k registered commitment C".
//
//   MEMBER_PRIVATE_KEY=0x... node scripts/register.mjs --token 1
import { ethers } from "ethers";
import { existsSync } from "node:fs";
import { RPC_URL, REGISTRY_ABI, arg, loadDeployment, newIdentity, notePath, saveNote } from "./lib.mjs";

const tokenId = BigInt(arg("token"));
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.MEMBER_PRIVATE_KEY, provider);
const dep = await loadDeployment(provider);
const registry = new ethers.Contract(dep.registry, REGISTRY_ABI, wallet);

if (await registry.tokenRegistered(tokenId)) throw new Error(`token ${tokenId} already registered`);
const path = arg("note", notePath(dep.chainId, dep.registry, tokenId));
if (existsSync(path)) throw new Error(`${path} exists; refusing to overwrite an identity`);

// Persist the secret BEFORE the tx: if we crash after it lands, the note must survive.
const id = newIdentity();
saveNote(path, { ...id, tokenId, chainId: dep.chainId, registry: dep.registry, leafIndex: null });

const receipt = await (await registry.register(tokenId, id.commitment)).wait();
const ev = receipt.logs.map((l) => registry.interface.parseLog(l)).find((e) => e?.name === "MemberRegistered");
saveNote(path, { ...id, tokenId, chainId: dep.chainId, registry: dep.registry, leafIndex: Number(ev.args.leafIndex) });

console.log(`registered token ${tokenId} from ${wallet.address} as leaf ${ev.args.leafIndex}`);
console.log(`identity note saved to ${path} — back it up; without it you cannot vote`);
