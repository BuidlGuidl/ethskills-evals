import { hexlify, keccak256, randomBytes } from "ethers";
import { hashPair, FIELD_SAFE_BOUND } from "./hash.js";

/** Domain tag of a membership leaf; a proposal scope is never 0. */
export const LEAF_TAG = 0n;

/**
 * Message a member signs once to derive their voting secret.
 *
 * Deriving the secret from a signature means there is nothing to back up: the
 * member can recompute it on any machine from the same wallet. The trade-off:
 * whoever holds the member's private key can recompute every nullifier that
 * member ever published, and therefore read their past votes. If that is not
 * acceptable, use a freshly generated secret (`randomSecret`) kept offline and
 * never derivable from the wallet.
 */
export const SECRET_DERIVATION_MESSAGE = "dao-private-vote: voting identity v1";

/** Squeeze any 32-byte value into the < 2^248 range the circuit expects. */
function toFieldElement(hex) {
  return BigInt(hex) >> 8n;
}

export function randomSecret() {
  return toFieldElement(hexlify(randomBytes(32)));
}

/** @param signer an ethers Signer for the member's wallet. */
export async function deriveSecret(signer) {
  const signature = await signer.signMessage(SECRET_DERIVATION_MESSAGE);
  return toFieldElement(keccak256(signature));
}

/** The public leaf that goes into the membership tree. */
export function commitmentFor(secret) {
  const commitment = hashPair(secret, LEAF_TAG);
  if (commitment === 0n || commitment >= FIELD_SAFE_BOUND) throw new Error("commitment out of range");
  return commitment;
}

/**
 * What a nullifier is bound to, mirroring PrivateBallot.proposalScope():
 * this proposal, in this contract, on this chain. Without the last two, a
 * ballot could be replayed onto a redeployment or another chain.
 */
export function proposalScopeFor(ballotAddress, chainId, proposalId) {
  const domain = hashPair(BigInt(ballotAddress), BigInt(chainId));
  return hashPair(domain, BigInt(proposalId));
}

/**
 * The value that makes double voting impossible while staying unlinkable:
 * one deterministic value per (member, proposal), and nothing in it points
 * back at the member's leaf.
 */
export function nullifierFor(secret, proposalScope) {
  if (BigInt(proposalScope) === LEAF_TAG) throw new Error("scope 0 is the leaf domain tag");
  return hashPair(secret, BigInt(proposalScope));
}
