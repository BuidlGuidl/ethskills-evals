#!/usr/bin/env node
/**
 * Step one for a member: turn a secret into a published voting key.
 *
 * Sent from the member's own NFT-holding wallet, and openly attributable - that is
 * the point. Membership is already public, so hiding registration would buy nothing;
 * what has to stay hidden is the link from this commitment to a future ballot, and
 * that link is the secret, which never leaves this process.
 *
 *   node js/register.js --key 0x<member wallet key> --passphrase "..."
 *   node js/register.js --key 0x<member wallet key> --token-id 7
 */
import { Identity } from "./core/identity.js";
import { connect, wallet, findUnregisteredToken, DEFAULT_RPC } from "./core/chain.js";
import { toHex32 } from "./core/hash.js";
import { parseArgs, step, info, warn, fail, resolveIdentity } from "./core/cli.js";

async function main() {
  const args = parseArgs();
  const memberKey = args.key ?? process.env.MEMBER_PK;
  if (!memberKey || memberKey === true) {
    fail("pass --key 0x<private key of the wallet holding the membership NFT> (or set MEMBER_PK)");
  }

  const { provider, registry, nft, deployment } = await connect({ rpcUrl: args.rpc ?? DEFAULT_RPC });
  const member = wallet(memberKey, provider);

  step(1, "Derive the voting identity (offchain, never transmitted)");
  let identity = await resolveIdentity(args, { Identity });
  if (!identity) {
    identity = Identity.random();
    warn("no --secret/--passphrase given, generated a fresh secret - SAVE IT, it is the only");
    warn("way to vote, and losing it means losing the vote for every future proposal.");
  }
  info("member wallet", member.address);
  info("secret", identity.toHex());
  info("commitment H(secret)", toHex32(identity.commitment));

  step(2, "Check eligibility");
  const balance = await nft.balanceOf(member.address);
  info("membership NFTs held", balance.toString());
  if (balance === 0n) fail("this wallet holds no membership NFT, so it cannot register");

  // One voting key per NFT, not per wallet - see MemberRegistry.register.
  const tokenId =
    args["token-id"] && args["token-id"] !== true
      ? BigInt(args["token-id"])
      : await findUnregisteredToken(nft, registry, member.address);
  if (tokenId === null) fail("every membership NFT this wallet holds already has a voting key");
  if ((await nft.ownerOf(tokenId)) !== member.address) fail(`this wallet does not own token ${tokenId}`);
  if ((await registry.commitmentOfToken(tokenId)) !== "0x" + "0".repeat(64)) {
    fail(`token ${tokenId} already has a voting key`);
  }
  info("registering token", tokenId.toString());

  step(3, "Publish the commitment onchain");
  info("registry", deployment.memberRegistry);
  const tx = await registry.connect(member).register(tokenId, toHex32(identity.commitment));
  const receipt = await tx.wait();
  info("tx hash", receipt.hash);
  info("sent by", member.address);

  const [count, root] = await Promise.all([registry.memberCount(), registry.root()]);
  info("members registered", count.toString());
  info("new tree root", root);

  console.log(
    "\nWhat a chain observer learns from this transaction: that this specific member\n" +
      "published this specific commitment. Nothing about any future ballot.\n",
  );
}

main().catch((err) => fail(err.stack ?? err.message));
