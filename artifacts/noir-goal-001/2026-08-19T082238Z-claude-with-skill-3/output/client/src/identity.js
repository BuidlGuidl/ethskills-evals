// A member's voting identity, and the note file that has to outlive the process.
//
// `secret` and `trapdoor` are the only things that let a member vote. They are never
// sent anywhere: registration publishes only their hash, and voting publishes only a
// proof. Lose the note and that member is silently disenfranchised for every future
// proposal -- there is no recovery path, by construction.

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { getPoseidon2, FIELD_MODULUS } from "./poseidon.js";

function randomField() {
  return BigInt("0x" + randomBytes(32).toString("hex")) % FIELD_MODULUS;
}

/**
 * Create a fresh identity. `commitment` is what goes onchain.
 * Both preimages are random over the whole field, so the published commitment is not
 * brute-forceable back to anything.
 */
export async function createIdentity() {
  const poseidon2 = await getPoseidon2();
  const secret = randomField();
  const trapdoor = randomField();
  return { secret, trapdoor, commitment: poseidon2(secret, trapdoor) };
}

export async function identityFromSecrets(secret, trapdoor) {
  const poseidon2 = await getPoseidon2();
  return { secret, trapdoor, commitment: poseidon2(secret, trapdoor) };
}

/**
 * The per-proposal spend marker: Poseidon(secret, proposalId).
 * Scoped to the proposal in-circuit, so the same member's markers on two proposals
 * are unlinkable values -- without the scoping, every proposal a member voted on
 * would share one nullifier and their whole voting history would link up.
 */
export async function nullifierHash(secret, proposalId) {
  const poseidon2 = await getPoseidon2();
  return poseidon2(secret, BigInt(proposalId));
}

/** Persist the note. `leafIndex` is filled in once registration is mined. */
export function saveNote(path, note) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        secret: "0x" + note.secret.toString(16),
        trapdoor: "0x" + note.trapdoor.toString(16),
        commitment: "0x" + note.commitment.toString(16),
        leafIndex: note.leafIndex ?? null,
        registry: note.registry ?? null,
        chainId: note.chainId ?? null,
      },
      null,
      2,
    ) + "\n",
  );
}

export function loadNote(path) {
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return {
    secret: BigInt(raw.secret),
    trapdoor: BigInt(raw.trapdoor),
    commitment: BigInt(raw.commitment),
    leafIndex: raw.leafIndex,
    registry: raw.registry,
    chainId: raw.chainId,
  };
}
