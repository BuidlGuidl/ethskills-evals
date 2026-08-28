/**
 * Stand up a realistic local scenario so client/vote.mjs has something to vote on:
 * a crowd of members joins the registry, then one member opens a proposal.
 *
 *   anvil                        # terminal 1
 *   ./scripts/deploy-local.sh
 *   node client/demo.mjs         # terminal 2: everyone joins, proposal opens
 *   npm run vote                 # one member casts an anonymous ballot
 *   node client/demo.mjs tally 0
 *
 * The extra members are the anonymity set. With 5 members a vote is hidden
 * 1-in-5; with the DAO's real 150 it is 1-in-150. Nothing else about the
 * protocol changes with the count.
 */
import { JsonRpcProvider, HDNodeWallet, Mnemonic } from "ethers";
import { deriveIdentityFromSigner, identityFromSeed, toBytes32 } from "./lib/identity.mjs";
import { findMemberTokenId, loadDeployment, nftAt, registryAt, votingAt } from "./lib/contracts.mjs";

const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const MEMBERS = Number(process.env.DEMO_MEMBERS ?? 8);
const VOTING_PERIOD = Number(process.env.VOTING_PERIOD ?? 3 * 24 * 3600);

const provider = new JsonRpcProvider(RPC_URL);
const { chainId } = await provider.getNetwork();
const deployment = await loadDeployment(chainId.toString());

const wallet = (i) =>
  HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(ANVIL_MNEMONIC), `m/44'/60'/0'/0/${i}`).connect(provider);

const [command, arg] = process.argv.slice(2).filter((a) => a !== "--");

if (command === "tally") {
  // Skip past the deadline. Only anvil lets you do this; on a real chain you wait.
  const voting = votingAt(deployment.anonymousVoting, provider);
  const proposal = await voting.getProposal(BigInt(arg ?? 0));
  const now = (await provider.getBlock("latest")).timestamp;
  if (now < Number(proposal.deadline)) {
    await provider.send("evm_setNextBlockTimestamp", [Number(proposal.deadline) + 1]);
    await provider.send("evm_mine", []);
    console.log("fast-forwarded past the deadline (anvil only)");
  }
  const [yes, no, eligible, passed] = await voting.tally(BigInt(arg ?? 0));
  console.log(`"${proposal.description}"`);
  console.log(`yes ${yes}  no ${no}  of ${eligible} eligible members -> ${passed ? "PASSED" : "REJECTED"}`);
  console.log("Which members those were is not recorded anywhere, onchain or off.");
  process.exit(0);
}

// --- everyone joins the anonymity set, each from their own wallet -----------
const deployer = wallet(0);
const nft = nftAt(deployment.membershipNft, deployer);

for (let i = 0; i < MEMBERS; i += 1) {
  const member = wallet(i);
  const registry = registryAt(deployment.membershipRegistry, member);

  if ((await nft.balanceOf(member.address)) === 0n) {
    await (await nft.mint(member.address)).wait();
  }
  const tokenId = await findMemberTokenId(nft, member.address, deployment.startBlock ?? 0);
  if (await registry.hasJoined(tokenId)) continue;

  // Member 0 is the one client/vote.mjs drives, so it must join with the same
  // wallet-signature identity that script will derive. Everyone else uses a
  // throwaway passphrase identity.
  const { commitment } =
    i === 0 ? await deriveIdentityFromSigner(member) : identityFromSeed(`demo-member-${i}`);
  await (await registry.join(tokenId, commitment)).wait();
  console.log(`member ${i} ${member.address} (token #${tokenId}) joined with ${toBytes32(commitment)}`);
}

const registry = registryAt(deployment.membershipRegistry, provider);
console.log(`anonymity set: ${await registry.memberCount()} members, root ${toBytes32(await registry.root())}`);

// --- one member opens a proposal -------------------------------------------
const voting = votingAt(deployment.anonymousVoting, wallet(1));
const proposalId = await voting.proposalCount();
await (await voting.createProposal("Fund the Q3 grants round with 50 ETH", VOTING_PERIOD)).wait();
const proposal = await voting.getProposal(proposalId);
console.log(
  `proposal ${proposalId} open until ${new Date(Number(proposal.deadline) * 1000).toISOString()}, ` +
    `snapshot of ${proposal.snapshotMemberCount} members`
);
console.log("\nnow run:  npm run vote");
