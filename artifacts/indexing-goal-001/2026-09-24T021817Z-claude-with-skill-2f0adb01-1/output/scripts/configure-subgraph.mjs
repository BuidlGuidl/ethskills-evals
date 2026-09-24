#!/usr/bin/env node
/**
 * Points subgraph.yaml at a deployment.
 *
 *   node scripts/configure-subgraph.mjs <network>
 *
 * Reads contracts/deployments/<network>.json (written by the deploy/seed
 * scripts) and rewrites the data source's `network`, `address` and
 * `startBlock`. `startBlock` is the one that matters: set it to the contract's
 * deployment block and the indexer replays every check-in ever made; set it
 * too late and the feed, streaks and leaderboard silently lose their history.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const network = process.argv[2] ?? "base";

const deployment = JSON.parse(
  readFileSync(resolve(root, `contracts/deployments/${network}.json`), "utf8")
);

const manifestPath = resolve(root, "subgraph/subgraph.yaml");
const manifest = readFileSync(manifestPath, "utf8")
  .replace(/^(\s*)network:.*$/m, `$1network: ${network}`)
  .replace(/^(\s*)address:.*$/m, `$1address: "${deployment.address}"`)
  .replace(/^(\s*)startBlock:.*$/m, `$1startBlock: ${deployment.startBlock}`);

writeFileSync(manifestPath, manifest);
console.log(
  `subgraph.yaml -> network=${network} address=${deployment.address} startBlock=${deployment.startBlock}`
);
