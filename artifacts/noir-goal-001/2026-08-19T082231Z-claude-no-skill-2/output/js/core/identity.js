import { randomBytes, createHash } from "node:crypto";
import { AbiCoder } from "ethers";
import { FIELD_BOUND, hashField, toBytes32 } from "./hash.js";

const abi = AbiCoder.defaultAbiCoder();

/**
 * A member's voting identity.
 *
 * `secret` is the only thing that must never leave the member's machine. It is not
 * their wallet key and is not derived from it: deriving it from an ETH key would tie
 * the vote key to the wallet that publicly holds the membership NFT, and would make
 * rotation impossible without moving the NFT.
 */
export class Identity {
  constructor(secret) {
    if (secret <= 0n || secret >= FIELD_BOUND) throw new RangeError("secret out of field range");
    this.secret = secret;
  }

  /** Fresh random identity. Print it once, store it like a seed phrase. */
  static random() {
    // 31 bytes is exactly the range our truncated hashes live in, so no rejection
    // sampling and no modulo bias.
    const bytes = randomBytes(31);
    let value = BigInt("0x" + bytes.toString("hex"));
    if (value === 0n) value = 1n;
    return new Identity(value);
  }

  /**
   * Deterministic identity from a passphrase, so a member can recover their voting
   * key from something memorable instead of a file. Weak passphrases are a real risk:
   * anyone who guesses one can vote as that member and, worse, can recompute their
   * nullifiers and learn how they voted on every past proposal.
   */
  static fromPassphrase(passphrase) {
    const digest = createHash("sha256")
      .update(Buffer.from("dao-private-ballot/identity/v1 ", "utf8"))
      .update(Buffer.from(passphrase, "utf8"))
      .digest();
    return new Identity(BigInt("0x" + digest.toString("hex")) >> 8n);
  }

  static fromHex(hex) {
    return new Identity(BigInt(hex));
  }

  toHex() {
    return "0x" + toBytes32(this.secret).toString("hex");
  }

  /** Public leaf, published onchain at registration: H(secret). */
  get commitment() {
    return hashField(this.secret);
  }

  /**
   * Spend-once tag for one proposal: H(secret, scope).
   *
   * Deterministic, so a second ballot on the same proposal is rejected. Unlinkable to
   * `commitment` without `secret`, so the nullifier tells an observer nothing about
   * who cast the ballot. The DAO cannot precompute the lookup table either: doing so
   * would require every member's secret.
   */
  nullifier(scope) {
    return hashField(this.secret, scope);
  }
}

/**
 * Per-proposal domain separator. Must match `PrivateBallot.voteScope`:
 * sha256(abi.encode(ballotAddress, proposalId)) truncated to its top 248 bits.
 */
export function voteScope(ballotAddress, proposalId) {
  const encoded = abi.encode(["address", "uint256"], [ballotAddress, proposalId]);
  const digest = createHash("sha256").update(Buffer.from(encoded.slice(2), "hex")).digest();
  return BigInt("0x" + digest.toString("hex")) >> 8n;
}
