// Sealed-bid range proof.
//
// Proves: "I know (bid, salt) such that the public commitment opens to them,
// and min_bid <= bid <= max_bid" — without revealing bid or salt.
//
// ─── Commitment scheme (the frontend MUST compute exactly this) ─────────────
//
//   commitment = Poseidon_BN254_hash_4([bid, salt, auction_id, bidder])
//
//   Hash:   original Poseidon over BN254 (circomlib-compatible parameters),
//           4 inputs (t = 5), as in noir-lang/poseidon v0.3.0
//           `poseidon::poseidon::bn254::hash_4`. NOT Poseidon2, NOT keccak.
//           In JS: `poseidon4` from `poseidon-lite` (or circomlibjs
//           `poseidon([...])`) produces the same output.
//   Order:  exactly [bid, salt, auction_id, bidder]. Changing the order
//           changes the hash.
//   bid:        the bid amount in wei, as an integer < 2^128.
//   salt:       32 random bytes from crypto.getRandomValues, reduced mod the
//               BN254 scalar field r =
//               21888242871839275222246405745257518495616224131802111647005978519491092685849
//               (i.e. a uniformly random field element). The bid lives in a
//               tiny domain, so without this blinding factor anyone could
//               brute-force the bid from the onchain commitment. Generate a
//               fresh salt per bid, never reuse it, and persist {bid, salt}
//               locally (plus an optional user backup) — losing it means the
//               bidder can never produce the proof.
//   auction_id: the auction's uint256 id as a field element (must be < r).
//               Binds the commitment to one auction so it can't be replayed
//               into another.
//   bidder:     the bidder's 20-byte address as an integer (uint160 -> Field).
//               Binds the commitment and the proof to the committing account,
//               so nobody can copy another bidder's commitment into their own
//               slot and then replay that bidder's proof.
//
//   All four values are passed to the hash as bigints (field elements), not
//   as byte strings or ABI-encoded bytes. The contract stores the resulting
//   bytes32 commitment per (auction_id, bidder) during the bidding window.
//
// ─── What the verifying contract must check ─────────────────────────────────
//
//   Public inputs, in this exact order (matching the parameter order below):
//     [commitment, auction_id, bidder, min_bid, max_bid]
//   The contract must NOT take these from the caller blindly: it must
//   supply commitment = stored commitment for (auction_id, bidder),
//   bidder = the address that made that commitment, and min_bid/max_bid =
//   the auction's configured bounds, then call verifier.verify(proof, inputs).
//
// ─── Cost ───────────────────────────────────────────────────────────────────
//   One 4-input Poseidon plus a few 128-bit range checks — a few hundred
//   gates, cheap enough for in-browser proving on phones.

use poseidon::poseidon::bn254::hash_4;

fn main(
    // Private witness
    bid: u128,
    salt: Field,
    // Public inputs
    commitment: pub Field,
    auction_id: pub Field,
    bidder: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // Typed u128 inputs are range-constrained to [0, 2^128), so these are
    // genuine integer comparisons — never compare raw Fields, where a
    // "negative" value wraps to a huge number.
    assert(bid >= min_bid, "bid below minimum");
    assert(bid <= max_bid, "bid above maximum");

    // Address must fit in 160 bits so there is exactly one field encoding.
    bidder.assert_max_bit_size::<160>();

    let computed = hash_4([bid as Field, salt, auction_id, bidder]);
    assert(computed == commitment, "commitment mismatch");
}

#[test]
fn test_valid_bid() {
    let bid: u128 = 1_500_000_000_000_000_000; // 1.5 ETH
    let salt = 0x1234567890abcdef;
    let auction_id = 7;
    let bidder = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    let commitment = hash_4([bid as Field, salt, auction_id, bidder]);
    main(bid, salt, commitment, auction_id, bidder, 1_000_000_000_000_000_000, 2_000_000_000_000_000_000);
}

#[test]
fn test_bid_at_bounds() {
    let salt = 42;
    let c_lo = hash_4([100, salt, 1, 0xabc]);
    main(100, salt, c_lo, 1, 0xabc, 100, 200);
    let c_hi = hash_4([200, salt, 1, 0xabc]);
    main(200, salt, c_hi, 1, 0xabc, 100, 200);
}

#[test(should_fail_with = "bid below minimum")]
fn test_bid_too_low() {
    let c = hash_4([99, 42, 1, 0xabc]);
    main(99, 42, c, 1, 0xabc, 100, 200);
}

#[test(should_fail_with = "bid above maximum")]
fn test_bid_too_high() {
    let c = hash_4([201, 42, 1, 0xabc]);
    main(201, 42, c, 1, 0xabc, 100, 200);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_wrong_salt() {
    let c = hash_4([150, 42, 1, 0xabc]);
    main(150, 43, c, 1, 0xabc, 100, 200);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_other_bidder_cannot_reuse() {
    let c = hash_4([150, 42, 1, 0xabc]);
    main(150, 42, c, 1, 0xdef, 100, 200);
}
