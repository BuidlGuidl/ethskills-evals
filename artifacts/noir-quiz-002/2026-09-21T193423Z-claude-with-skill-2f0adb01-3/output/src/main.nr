// Sealed-bid range proof.
//
// Proves: "the bid hidden inside `commitment` satisfies min_bid <= bid <= max_bid"
// without revealing the bid or the salt.
//
// ─────────────────────────────────────────────────────────────────────────────
// COMMITMENT SCHEME (the frontend MUST compute it exactly like this)
// ─────────────────────────────────────────────────────────────────────────────
//
//   commitment = Poseidon([COMMIT_DOMAIN, auction_id, bidder, bid, salt])
//
//   Hash:        Poseidon over BN254, 5 inputs (width-6 permutation), circomlib
//                parameters. In Noir: `poseidon::poseidon::bn254::hash_5`.
//                In JS: `poseidon5` from `poseidon-lite` (or circomlibjs
//                `buildPoseidon()` called with 5 inputs). NOT Poseidon2, NOT
//                Pedersen, NOT keccak — those give different outputs.
//   Input order: exactly as listed above. Order changes the hash.
//
//   COMMIT_DOMAIN = 0x5345414c45445f424944 (ASCII "SEALED_BID" as a big-endian
//                   integer). A fixed tag so this hash can never collide with any
//                   other Poseidon hash the platform computes.
//   auction_id  = the auction's uint256 id as used by the contract. Must be
//                 < the BN254 scalar field modulus (any sequential id is).
//                 Binds the commitment to one auction so it can't be reused.
//   bidder      = the bidder's 20-byte Ethereum address as an integer, i.e.
//                 BigInt(address). This is the address that will call the
//                 contract (msg.sender) both to commit and to submit the proof.
//                 Binding it means copying someone else's commitment (e.g. out
//                 of the mempool) and replaying their proof is useless.
//   bid         = bid amount in wei, as an integer in [0, 2^128).
//   salt        = 31 bytes from crypto.getRandomValues(), read as a big-endian
//                 integer. 31 bytes keeps it below the field modulus without
//                 reduction. The salt is what hides the bid: bid amounts are a
//                 small, guessable domain, so without a secret salt anyone could
//                 brute-force the commitment. The bidder MUST persist
//                 { auction_id, bid, salt } locally — without it they cannot
//                 produce a proof after the window closes.
//
//   Frontend (TypeScript):
//
//     import { poseidon5 } from "poseidon-lite";
//     const COMMIT_DOMAIN = 0x5345414c45445f424944n;
//     const saltBytes = crypto.getRandomValues(new Uint8Array(31));
//     const salt = BigInt("0x" + Array.from(saltBytes, b => b.toString(16).padStart(2, "0")).join(""));
//     const commitment = poseidon5([COMMIT_DOMAIN, auctionId, BigInt(bidderAddress), bidWei, salt]);
//     // publish as bytes32: "0x" + commitment.toString(16).padStart(64, "0")
//
//   Before shipping, check hash parity once: compute poseidon5 in JS for fixed
//   inputs, put the result in Prover.toml as `commitment`, and confirm
//   `nargo execute` succeeds.
//
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC INPUTS (order = verifier `publicInputs` order; contract must match)
// ─────────────────────────────────────────────────────────────────────────────
//   [0] commitment  — the bytes32 the contract stored for (auction_id, bidder)
//   [1] auction_id
//   [2] bidder      — contract passes uint256(uint160(msg.sender))
//   [3] min_bid     — from auction config, never user-supplied
//   [4] max_bid     — from auction config, never user-supplied
//
// The contract must build all five values from its own state/msg.sender and
// only take the proof bytes from the caller.
//
// Cost: one Poseidon permutation + range checks on three u128 values and two
// comparisons — a few hundred gates, so proving is fast even on phones.

use poseidon::poseidon::bn254::hash_5;

global COMMIT_DOMAIN: Field = 0x5345414c45445f424944; // "SEALED_BID"

fn main(
    // Private
    bid: u128,
    salt: Field,
    // Public
    commitment: pub Field,
    auction_id: pub Field,
    bidder: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // u128-typed inputs are range-constrained to [0, 2^128) by the compiler, so
    // the comparisons below can't be bypassed by field wrap-around.
    assert(commit(auction_id, bidder, bid, salt) == commitment, "commitment mismatch");
    assert(bid >= min_bid, "bid below min");
    assert(bid <= max_bid, "bid above max");
}

fn commit(auction_id: Field, bidder: Field, bid: u128, salt: Field) -> Field {
    hash_5([COMMIT_DOMAIN, auction_id, bidder, bid as Field, salt])
}

#[test]
fn test_bid_in_range() {
    let c = commit(7, 0xabcdef, 5000, 0x1234);
    main(5000, 0x1234, c, 7, 0xabcdef, 1000, 10000);
    // Boundaries are inclusive.
    main(5000, 0x1234, c, 7, 0xabcdef, 5000, 5000);
}

#[test(should_fail_with = "bid above max")]
fn test_bid_above_max() {
    let c = commit(7, 0xabcdef, 20000, 0x1234);
    main(20000, 0x1234, c, 7, 0xabcdef, 1000, 10000);
}

#[test(should_fail_with = "bid below min")]
fn test_bid_below_min() {
    let c = commit(7, 0xabcdef, 500, 0x1234);
    main(500, 0x1234, c, 7, 0xabcdef, 1000, 10000);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_wrong_bidder() {
    let c = commit(7, 0xabcdef, 5000, 0x1234);
    main(5000, 0x1234, c, 7, 0x999999, 1000, 10000);
}
