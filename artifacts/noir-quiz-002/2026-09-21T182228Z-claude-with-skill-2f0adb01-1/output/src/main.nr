// Sealed-bid range proof.
//
// Proves: "the bid inside my onchain commitment satisfies min_bid <= bid <= max_bid"
// without revealing the bid or the salt.
//
// ─── Commitment scheme (the frontend MUST compute it exactly like this) ───────
//
//   commitment = Poseidon_BN254([bid, salt, auction_id, bidder])      // 4 inputs, t = 5
//
//   - Hash: circomlib-compatible Poseidon over BN254, 4-input variant. This is
//     `poseidon::poseidon::bn254::hash_4` in Noir, `poseidon4` from `poseidon-lite`,
//     or `poseidon([...])` with 4 inputs from `circomlibjs`. NOT Poseidon2, NOT
//     keccak, NOT pedersen — those produce different outputs.
//   - Input order is exactly [bid, salt, auction_id, bidder].
//   - bid:        bid amount in wei, as an integer in [0, 2^128).
//   - salt:       32 bytes from crypto.getRandomValues, reduced mod the BN254 scalar
//                 field r = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001
//                 (or just sample 31 random bytes so it is always < r). The salt is
//                 what hides the bid — bids come from a tiny, guessable domain, so
//                 without a high-entropy salt anyone could brute-force the
//                 commitment. Persist it locally (with the bid); losing it means the
//                 bidder cannot prove later.
//   - auction_id: the auction's uint256 id as used by the contract (must be < r).
//   - bidder:     the bidder's 20-byte Ethereum address as an integer
//                 (BigInt("0x...")). This must be the wallet that submits the proof.
//
//   The commitment is posted onchain as bytes32 (big-endian field element).
//
//   Example (JS):
//     import { poseidon4 } from "poseidon-lite";
//     const commitment = poseidon4([bidWei, salt, auctionId, BigInt(bidderAddress)]);
//     const commitmentHex = "0x" + commitment.toString(16).padStart(64, "0");
//
// Why auction_id and bidder are bound in: without them, a bidder could copy
// someone else's commitment during the bidding window and later replay that
// bidder's proof, or reuse one commitment/proof across auctions. The contract
// must therefore check `bidder == msg.sender` and `auction_id == this auction`.
//
// ─── Public inputs (order = order of `pub` params below) ──────────────────────
//   [0] commitment  [1] min_bid  [2] max_bid  [3] auction_id  [4] bidder
// The contract must supply commitment from its own storage (the one this bidder
// posted), min_bid/max_bid from the auction config, auction_id from the auction,
// and bidder = msg.sender — never take any of these from the caller unchecked.
//
// Cost: one 4-input Poseidon (~a few hundred gates) plus two u128 comparisons.
// Typing bid/min/max as u128 range-checks them for free relative to a manual
// decomposition, and makes the comparisons sound (no field wraparound).

use poseidon::poseidon::bn254::hash_4;

fn main(
    // Private
    bid: u128,
    salt: Field,
    // Public
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    auction_id: pub Field,
    bidder: pub Field,
) {
    let computed = hash_4([bid as Field, salt, auction_id, bidder]);
    assert(computed == commitment, "Commitment mismatch");

    assert(bid >= min_bid, "Bid below minimum");
    assert(bid <= max_bid, "Bid above maximum");
}

#[test]
fn test_bid_in_range() {
    let bid: u128 = 1_500_000_000_000_000_000; // 1.5 ETH
    let salt = 0x1234567890abcdef;
    let auction_id = 7;
    let bidder = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    let commitment = hash_4([bid as Field, salt, auction_id, bidder]);
    main(bid, salt, commitment, 1_000_000_000_000_000_000, 2_000_000_000_000_000_000, auction_id, bidder);
}

#[test]
fn test_bid_at_bounds() {
    let salt = 42;
    let auction_id = 1;
    let bidder = 0xabc;
    let lo: u128 = 100;
    let hi: u128 = 200;
    main(lo, salt, hash_4([lo as Field, salt, auction_id, bidder]), lo, hi, auction_id, bidder);
    main(hi, salt, hash_4([hi as Field, salt, auction_id, bidder]), lo, hi, auction_id, bidder);
}

#[test(should_fail_with = "Bid above maximum")]
fn test_bid_above_max() {
    let bid: u128 = 201;
    let commitment = hash_4([bid as Field, 42, 1, 0xabc]);
    main(bid, 42, commitment, 100, 200, 1, 0xabc);
}

#[test(should_fail_with = "Bid below minimum")]
fn test_bid_below_min() {
    let bid: u128 = 99;
    let commitment = hash_4([bid as Field, 42, 1, 0xabc]);
    main(bid, 42, commitment, 100, 200, 1, 0xabc);
}

#[test(should_fail_with = "Commitment mismatch")]
fn test_wrong_bidder() {
    let bid: u128 = 150;
    let commitment = hash_4([bid as Field, 42, 1, 0xabc]);
    main(bid, 42, commitment, 100, 200, 1, 0xdef);
}

// Cross-check vector for the frontend: poseidon-lite `poseidon4([1n, 2n, 3n, 4n])`
// returns this same value.
#[test]
fn test_hash_parity_with_poseidon_lite() {
    assert(hash_4([1, 2, 3, 4]) == 0x299c867db6c1fdd79dcefa40e4510b9837e60ebb1ce0663dbaa525df65250465);
}
