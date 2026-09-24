#!/usr/bin/env node
/**
 * Copies the Streak ABI out of the forge build artifact into the places that
 * need it (subgraph + web). Run after `forge build`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = JSON.parse(
  readFileSync(resolve(root, "contracts/out/Streak.sol/Streak.json"), "utf8")
);
const abi = artifact.abi;

const targets = [
  resolve(root, "subgraph/abis/Streak.json"),
  resolve(root, "web/src/abi/Streak.json"),
];

for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(abi, null, 2) + "\n");
  console.log("wrote", target.replace(root + "/", ""));
}
