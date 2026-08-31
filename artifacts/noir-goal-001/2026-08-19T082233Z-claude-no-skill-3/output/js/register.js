/**
 * Step 1 of the flow: join the anonymity set.
 *
 * Sends ONE transaction, from the member's own public wallet:
 *     MembershipRegistry.register(tokenId, commitment)
 *
 * A chain observer learns: "the wallet holding membership NFT #tokenId put
 * leaf `commitment` at index i". That link is permanent and unavoidable -
 * membership is public anyway. It is also harmless, because nothing in a later
 * ballot points back at this leaf.
 *
 *   node js/register.js [--member-key 0x..] [--token-id N]
 */
import { ANVIL_KEYS, connect, parseArgs } from "./core/chain.js";
import { commitmentFor, deriveSecret } from "./core/identity.js";

const args = parseArgs();
const { registry, nft, wallet } = await connect();

const member = wallet(args["member-key"] ?? process.env.MEMBER_KEY ?? ANVIL_KEYS[1]);
const secret = args.secret ? BigInt(args.secret) : await deriveSecret(member);
const commitment = commitmentFor(secret);

const tokenId = args["token-id"] !== undefined ? BigInt(args["token-id"]) : await findToken(member.address);

console.log("member wallet ", member.address);
console.log("membership NFT", tokenId.toString());
console.log("secret        ", "(never leaves this machine)");
console.log("commitment    ", "0x" + commitment.toString(16).padStart(64, "0"));

if (await registry.tokenRegistered(tokenId)) {
  console.log("\nthis NFT already has a leaf in the tree - nothing to do");
  process.exit(0);
}

const tx = await registry.connect(member).register(tokenId, commitment);
const receipt = await tx.wait();
const joined = receipt.logs
  .map((log) => {
    try {
      return registry.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .find((event) => event?.name === "MemberJoined");

console.log("\ntx 1  register()");
console.log("  from        ", member.address, "(the member, in the open)");
console.log("  hash        ", receipt.hash);
console.log("  gas used    ", receipt.gasUsed.toString());
console.log("  leaf index  ", joined.args.leafIndex.toString());
console.log("  new root    ", "0x" + joined.args.newRoot.toString(16).padStart(64, "0"));
console.log("  members now ", (await registry.memberCount()).toString());
console.log("\nobserver learns: this wallet is now in the anonymity set. Nothing about any vote.");

async function findToken(owner) {
  const supply = await nft.totalSupply();
  for (let id = 1n; id <= supply; id++) {
    if ((await nft.ownerOf(id)) === owner) return id;
  }
  throw new Error(`${owner} holds no membership NFT - pass --token-id`);
}
