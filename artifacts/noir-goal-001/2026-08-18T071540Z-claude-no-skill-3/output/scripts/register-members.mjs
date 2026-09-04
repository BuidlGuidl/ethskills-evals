// Members join the anonymous voter set.
//
// Each member sends their OWN registration transaction from the wallet holding
// their membership NFT. This transaction is public and attributable on purpose:
// it says "this member is eligible to vote", which the DAO already publishes.
// It reveals nothing about any future vote.
//
//   npm run register            # first 150 members
//   COUNT=25 npm run register

import { provider, loadDeployment, contractAt, memberWallet, RPC_URL } from "./common/deployment.mjs";
import { deriveSecret, commitmentFromSecret } from "./common/crypto.mjs";

const COUNT = Number(process.env.COUNT ?? 150);

async function main() {
  const rpc = provider();
  const deployment = loadDeployment(Number((await rpc.getNetwork()).chainId));
  const registry = contractAt("MemberRegistry", deployment.memberRegistry, rpc);

  console.log(`Registering ${COUNT} members against ${deployment.memberRegistry}\n`);

  let registered = 0;
  for (let i = 0; i < COUNT; i++) {
    const wallet = memberWallet(i, rpc);

    // Local devnet convenience: give the member gas money. On a real chain the
    // member already has ETH; how they got it is a privacy question of its own
    // and is discussed in NOTES.md.
    await rpc.send("anvil_setBalance", [wallet.address, "0xDE0B6B3A7640000"]);

    // Derived offline from a signature only this wallet can produce.
    const secret = await deriveSecret(wallet);
    const commitment = commitmentFromSecret(secret);

    if (await registry.tokenRegistered(i)) continue;

    const tx = await registry.connect(wallet).register(i, commitment);
    await tx.wait();
    registered++;

    if (registered % 25 === 0 || i === COUNT - 1) {
      console.log(`  ${registered} registered (latest: member ${i} -> leaf ${i})`);
    }
  }

  const memberCount = await registry.memberCount();
  console.log(`\nMembers in tree : ${memberCount}`);
  console.log(`Member root     : ${await registry.root()}`);
  console.log(`\nAnyone can rebuild that root from registry.allCommitments() (${RPC_URL}).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
