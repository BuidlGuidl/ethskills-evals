#!/usr/bin/env node
import { base, baseSepolia } from "viem/chains";
import type { Address, Chain } from "viem";
import {
  collectableSubscribers,
  findEverSubscribed,
  formatUsdc,
  lapsingSoon,
  type ScanConfig,
} from "./subscribers.js";

/**
 * Operator CLI. Two commands, both read-only — nothing here can move money.
 *
 *   npm run cli -- subscribers        list every address that has ever subscribed
 *   npm run cli -- collectable        who is worth settling, and the SUBSCRIBERS= line to paste
 *   npm run cli -- lapsing [days]     who runs out of money soon, so you can warn them
 *
 * Env: BILLING_ADDRESS, RPC_URL, DEPLOY_BLOCK, CHAIN (base | baseSepolia)
 */

const chains: Record<string, Chain> = { base, baseSepolia };

function config(): ScanConfig {
  const req = (n: string) => {
    const v = process.env[n];
    if (!v) throw new Error(`missing env var ${n}`);
    return v;
  };
  return {
    contract: req("BILLING_ADDRESS") as Address,
    chain: chains[process.env.CHAIN ?? "base"] ?? base,
    rpcUrl: req("RPC_URL"),
    fromBlock: BigInt(req("DEPLOY_BLOCK")),
  };
}

const command = process.argv[2] ?? "collectable";

if (command === "subscribers") {
  const list = await findEverSubscribed(config());
  console.log(`${list.length} addresses have ever subscribed:`);
  for (const a of list) console.log(a);
} else if (command === "collectable") {
  const rows = await collectableSubscribers(config());
  if (rows.length === 0) {
    console.log("nothing accrued since the last settle. Come back later.");
    process.exit(0);
  }
  const total = rows.reduce((s, r) => s + r.accrued, 0n);
  console.log(`${rows.length} accounts, ${formatUsdc(total)} accrued and unbooked:\n`);
  for (const r of rows) {
    const until = r.activeUntil ? new Date(r.activeUntil * 1000).toISOString().slice(0, 16) : "lapsed";
    console.log(`  ${r.address}  plan ${r.planId}  ${formatUsdc(r.accrued).padStart(10)}  until ${until}`);
  }
  console.log(`\nTo collect it:\n\n  SUBSCRIBERS=${rows.map((r) => r.address).join(",")} \\`);
  console.log(`    forge script script/Ops.s.sol --sig "collect()" --rpc-url base --broadcast\n`);
} else if (command === "lapsing") {
  const days = Number(process.argv[3] ?? 7);
  const rows = await lapsingSoon(config(), days * 86400);
  if (rows.length === 0) {
    console.log(`nobody lapses in the next ${days} days.`);
    process.exit(0);
  }
  console.log(`${rows.length} subscriptions run out within ${days} days — worth an email:\n`);
  for (const r of rows) {
    const when = new Date(r.activeUntil * 1000).toISOString().slice(0, 16).replace("T", " ");
    const hours = Math.round((r.activeUntil - Date.now() / 1000) / 3600);
    console.log(`  ${r.address}  plan ${r.planId}  lapses ${when}  (in ${hours}h)`);
  }
} else {
  console.error(`unknown command: ${command}\nusage: cli [subscribers|collectable|lapsing]`);
  process.exit(1);
}
