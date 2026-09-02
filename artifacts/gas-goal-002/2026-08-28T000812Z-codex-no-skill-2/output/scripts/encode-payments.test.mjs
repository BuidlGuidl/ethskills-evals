import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
const input = join(directory, "payouts.json");
writeFileSync(input, JSON.stringify([
  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
]));
const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
assert.equal(output.length, 2 + 2 * 52 * 2);
assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
assert.equal(output.slice(-64), "10".padStart(64, "0"));
