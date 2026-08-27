#!/usr/bin/env node
//
// Step 1 of the flow: one member joins the vote.
//
//   node js/join.js --member 7
//
// Generates the member's voting secret (once, locally), publishes only the
// commitment to it, and proves the resulting Merkle root is the honest one.
// The transaction is sent by the member's own NFT-holding wallet — this step
// is deliberately public, it is the *ballot* that is anonymous.
import { connect, fundLocally, loadSecret, memberWallet, saveSecret, secretPath } from "./core/chain.js";
import { commitment, randomSecret } from "./core/identity.js";
import { hex32 } from "./core/poseidon.js";
import { proveCircuit } from "./core/prover.js";
import { buildTree, TREE_DEPTH } from "./core/tree.js";
import { parseArgs } from "./core/args.js";

export async function join({ memberIndex, fund = false }) {
  const { provider, chainId, registry } = await connect();
  const wallet = memberWallet(memberIndex, provider);
  if (fund) await fundLocally(provider, wallet.address, "10");

  // --- the secret. Created here, on the member's machine, and nowhere else.
  let secret = loadSecret(chainId, `member-${memberIndex}`);
  if (secret === null) {
    secret = randomSecret();
    saveSecret(chainId, `member-${memberIndex}`, secret);
  }
  const leaf = commitment(secret);

  if (await registry.hasJoined(wallet.address)) {
    return { alreadyJoined: true, address: wallet.address, commitment: hex32(leaf) };
  }

  // --- rebuild the current tree from the registry's own commitment list, so
  //     we can prove where the next leaf goes.
  const leaves = (await registry.allCommitments()).map(BigInt);
  const index = leaves.length;
  const before = buildTree(leaves);
  const after = buildTree([...leaves, leaf]);

  const onChainRoot = BigInt(await registry.root());
  if (before.root !== onChainRoot) {
    throw new Error(`registry root ${hex32(onChainRoot)} does not match the commitment list — refusing to join`);
  }

  // --- prove: "slot `index` was empty under `old_root`, and filling it with
  //     `leaf` gives `new_root`". The contract supplies old_root and index
  //     from its own storage, so there is nothing here for us to lie about.
  const { proof, publicInputs } = proveCircuit("register", {
    old_root: hex32(before.root),
    new_root: hex32(after.root),
    leaf: hex32(leaf),
    index: String(index),
    siblings: before.siblings(index).map(hex32),
  });
  if (publicInputs.length !== 4) throw new Error(`unexpected public input count ${publicInputs.length}`);

  const tx = await registry.connect(wallet).join(hex32(leaf), hex32(after.root), proof);
  const receipt = await tx.wait();

  return {
    address: wallet.address,
    secretFile: secretPath(chainId, `member-${memberIndex}`),
    commitment: hex32(leaf),
    index,
    newRoot: hex32(after.root),
    txHash: receipt.hash,
    gasUsed: receipt.gasUsed,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const result = await join({ memberIndex: Number(args.member ?? 0), fund: Boolean(args.fund) });
  if (result.alreadyJoined) {
    console.log(`member ${result.address} has already joined with commitment ${result.commitment}`);
  } else {
    console.log(`joined as leaf ${result.index} of a depth-${TREE_DEPTH} tree`);
    console.log(`  member wallet : ${result.address}  (sender of the join tx)`);
    console.log(`  secret stored : ${result.secretFile}`);
    console.log(`  commitment    : ${result.commitment}`);
    console.log(`  new root      : ${result.newRoot}`);
    console.log(`  tx            : ${result.txHash}  (gas ${result.gasUsed})`);
  }
}
