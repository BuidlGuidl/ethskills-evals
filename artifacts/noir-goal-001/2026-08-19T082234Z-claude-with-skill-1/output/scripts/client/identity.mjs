import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FIELD, hash2 } from "./poseidon.mjs";
import { ROOT } from "./env.mjs";

/// Where a member's note lives. Losing this file loses the vote: the registry
/// stores only H(secret, nullifierSecret), and there is no recovery path — a
/// re-join would leave the old leaf in the tree and hand the member two votes.
/// Gitignored. In a real deployment this is browser storage plus an export the
/// member is told, loudly, to back up.
export const NOTES_DIR = join(ROOT, "notes");

/// Uniform in [1, FIELD) by rejection sampling — no modulo bias.
function randomField() {
  for (;;) {
    const x = BigInt("0x" + randomBytes(32).toString("hex"));
    if (x > 0n && x < FIELD) return x;
  }
}

/// A member's long-term voting identity. Generated client-side; the two halves
/// never leave the member's machine.
///
/// `secret` and `nullifierSecret` are separate on purpose. Revealing a
/// nullifier hash (which every ballot must) must not reveal anything that lets
/// you recompute the commitment — otherwise the ballot would identify the leaf,
/// and the ZK proof would be pointless.
export function createIdentity() {
  const secret = randomField();
  const nullifierSecret = randomField();
  return { secret, nullifierSecret, commitment: hash2(secret, nullifierSecret) };
}

/// Per-proposal nullifier. Bound to the proposal id, so:
///   - a second ballot on the same proposal collides and is rejected onchain;
///   - ballots on two different proposals share no value, so a member's voting
///     history cannot be stitched together.
export function nullifierHashFor(nullifierSecret, proposalId) {
  return hash2(nullifierSecret, BigInt(proposalId));
}

function notePath(label) {
  return join(NOTES_DIR, `${label}.json`);
}

export function saveNote(label, note) {
  mkdirSync(NOTES_DIR, { recursive: true });
  const serialised = JSON.stringify(
    note,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
  writeFileSync(notePath(label), serialised + "\n");
  return notePath(label);
}

export function loadNote(label) {
  const p = notePath(label);
  if (!existsSync(p)) {
    throw new Error(`no note at ${p} — run "node scripts/join.mjs ${label}" first`);
  }
  const raw = JSON.parse(readFileSync(p, "utf8"));
  return {
    ...raw,
    secret: BigInt(raw.secret),
    nullifierSecret: BigInt(raw.nullifierSecret),
    commitment: BigInt(raw.commitment),
  };
}

export function noteExists(label) {
  return existsSync(notePath(label));
}
