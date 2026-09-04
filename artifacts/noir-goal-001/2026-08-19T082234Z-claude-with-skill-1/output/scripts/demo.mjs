#!/usr/bin/env node
/**
 * The whole thing, end to end, against a local chain.
 *
 *   anvil                                     # terminal 1
 *   forge script contracts/script/Deploy.s.sol:Deploy \
 *     --rpc-url http://127.0.0.1:8545 --broadcast
 *   node scripts/demo.mjs                     # terminal 2
 *
 * Runs the same CLI steps a real member would run, in order, so the console
 * output is the flow described in NOTES.md.
 */
import { spawnSync } from "node:child_process";
import { JsonRpcProvider } from "ethers";
import { ROOT, RPC_URL, loadDeployment } from "./client/env.mjs";

const VOTERS = [
  [1, "yes"],
  [2, "no"],
  [3, "yes"],
  [4, "yes"],
  [5, "no"],
  [7, "yes"],
];
const MEMBERS = Number(process.env.DEMO_MEMBERS ?? loadDeployment().memberCount);

function step(title) {
  console.log(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);
}

function run(script, args = []) {
  const r = spawnSync(process.execPath, [`scripts/${script}`, ...args.map(String)], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error(`scripts/${script} ${args.join(" ")} failed`);
}

step("0. hash parity — circuit / contract / client must agree before anything else");
run("check-hash-parity.mjs");

step(`1. ${MEMBERS} members join the anonymity set, each from their own wallet`);
for (let i = 1; i <= MEMBERS; i++) run("join.mjs", [i]);

step("2. a member opens a proposal (public: everyone sees who proposed)");
run("propose.mjs", ["Fund the grants program with 40 ETH", 3600]);

step("3. ballots — proved on the member's machine, broadcast by a relayer");
for (const [i, choice] of VOTERS) run("vote.mjs", [i, choice]);

step("4. tally is withheld while voting is open");
run("tally.mjs");

step("5. fast-forward past the deadline (local chain only) and read the result");
const p = new JsonRpcProvider(RPC_URL);
await p.send("evm_increaseTime", [3601]);
await p.send("evm_mine", []);
run("tally.mjs");

console.log(
  `\nWho voted which way is not recoverable from anything above: every ballot was\n` +
    `sent by the same relayer, proved against the same snapshot root, and carries a\n` +
    `nullifier that is unlinkable to any commitment.\n`,
);
