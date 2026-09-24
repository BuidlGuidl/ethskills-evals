// Sealed-bid range proof.
//
// Proves: "the bid inside my onchain commitment satisfies min_bid <= bid <= max_bid"
// without revealing the bid.
//
// ─── Commitment scheme (the frontend MUST compute it exactly like this) ─────
//
//   commitment = Poseidon([bid, blinding, bidder])
//
//   * Hash: original Poseidon over BN254, circomlib-compatible parameters,
//     3 inputs (t = 4), in exactly this order. NOT Poseidon2, NOT keccak.
//     In JS: `poseidon3([bid, blinding, bidder])` from `poseidon-lite`
//     (or `buildPoseidon()` from `circomlibjs`, then `F.toObject(...)`).
//     Output is a BN254 field element; store it onchain as bytes32 / uint256.
//
//   * bid:      the bid amount in wei as an unsigned integer, 0 <= bid < 2^128.
//               Passed to the hash as a field element (plain BigInt).
//
//   * blinding: 31 fresh random bytes from `crypto.getRandomValues`, read as a
//               big-endian BigInt (so it is always < the BN254 field modulus).
//               Mandatory: bids live in a tiny, guessable domain, so without
//               the blinding anyone could brute-force the bid from the
//               commitment. Generate a new one per bid and PERSIST it together
//               with the bid (e.g. encrypted in local storage / downloadable
//               backup) — without it the bidder can never produce the proof.
//
//   * bidder:   the bidder's 20-byte Ethereum address as a BigInt
//               (`BigInt(address)`). Onchain the contract passes
//               `uint256(uint160(msg.sender))`. Binding the address stops
//               another bidder from copying someone's commitment during the
//               bidding window and then replaying their proof.
//
// ─── Public inputs (order matters: the verifier sees them in this order) ────
//
//   [commitment, bidder, min_bid, max_bid]
//
// The auction contract must build that array itself from its own storage
// (the commitment it recorded for msg.sender, msg.sender, and the auction's
// configured bounds), never from caller-supplied values, and only accept the
// bid as in-range after `verifier.verify(proof, publicInputs)` returns true.
// It should also reject a commitment that has already been submitted.

use poseidon::poseidon::bn254::hash_3;

fn main(
    // Private witness.
    bid: u128,
    blinding: Field,
    // Public inputs.
    commitment: pub Field,
    bidder: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // Opening: the committed value really is this bid. Typing `bid` as u128
    // range-constrains it, so the comparisons below are over integers and
    // cannot be satisfied by a field element that wraps around the modulus.
    assert(hash_3([bid as Field, blinding, bidder]) == commitment, "commitment mismatch");

    // Range: min_bid <= bid <= max_bid.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

#[test]
fn test_bid_in_range() {
    let bid: u128 = 1_500_000_000_000_000_000; // 1.5 ETH
    let blinding = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd;
    let bidder = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    let commitment = hash_3([bid as Field, blinding, bidder]);
    main(bid, blinding, commitment, bidder, 1_000_000_000_000_000_000, 2_000_000_000_000_000_000);
}

#[test]
fn test_bid_at_bounds() {
    let blinding = 42;
    let bidder = 0xabc;
    main(10, blinding, hash_3([10, blinding, bidder]), bidder, 10, 20);
    main(20, blinding, hash_3([20, blinding, bidder]), bidder, 10, 20);
}

#[test(should_fail_with = "bid below min_bid")]
fn test_bid_below_min() {
    let blinding = 42;
    let bidder = 0xabc;
    main(9, blinding, hash_3([9, blinding, bidder]), bidder, 10, 20);
}

#[test(should_fail_with = "bid above max_bid")]
fn test_bid_above_max() {
    let blinding = 42;
    let bidder = 0xabc;
    main(21, blinding, hash_3([21, blinding, bidder]), bidder, 10, 20);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_wrong_blinding() {
    let bidder = 0xabc;
    main(15, 43, hash_3([15, 42, bidder]), bidder, 10, 20);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_other_bidder_cannot_reuse_commitment() {
    let commitment = hash_3([15, 42, 0xabc]);
    main(15, 42, commitment, 0xdef, 10, 20);
}
