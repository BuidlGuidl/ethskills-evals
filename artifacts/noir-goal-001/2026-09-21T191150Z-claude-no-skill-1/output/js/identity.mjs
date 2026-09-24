#!/usr/bin/env node
// Create or inspect a member identity (local only, no network).
//   node js/identity.mjs new  <file>
//   node js/identity.mjs show <file>
import { createIdentity, loadIdentity } from "./common/identity.mjs";

const [cmd, file] = process.argv.slice(2);
if (!file || !["new", "show"].includes(cmd)) {
  console.error("usage: node js/identity.mjs new|show <identity-file>");
  process.exit(1);
}
const id = cmd === "new" ? createIdentity(file) : loadIdentity(file);
console.log(`identity file: ${file}`);
console.log(`commitment (public, goes on-chain at registration): ${id.commitment}`);
