// Sealed-bid range proof.
//
// Proves: "the bid hidden inside `commitment` lies in [min_bid, max_bid]"
// without revealing the bid or the salt.
//
// ---------------------------------------------------------------------------
// COMMITMENT SCHEME — the frontend MUST compute it exactly like this
// ---------------------------------------------------------------------------
//
//   commitment = Poseidon([COMMITMENT_DOMAIN, auction_id, bidder, bid, salt])
//
//   * Hash: Poseidon over BN254, circomlib-compatible parameters, 5 inputs
//     (t = 6). This is `poseidon::poseidon::bn254::hash_5` in Noir and
//     matches `poseidon5` from `poseidon-lite` or `poseidon([...])` from
//     `circomlibjs`. NOT Poseidon2, NOT keccak256, NOT Pedersen.
//   * Input order is fixed and matters:
//       [0] COMMITMENT_DOMAIN = 0x5345414c45445f4249445f5631
//                               (ASCII "SEALED_BID_V1", as a field element)
//       [1] auction_id  — the auction's uint256 id in the contract. Must be
//                         < the BN254 scalar field modulus (a uint64 counter
//                         is the easy way to guarantee this).
//       [2] bidder      — the bidder's 20-byte Ethereum address interpreted
//                         as a big-endian integer (BigInt(address)). This is
//                         the address that will call the contract, i.e.
//                         msg.sender at commit time and at proof time.
//       [3] bid         — bid amount in wei as an integer, 0 <= bid < 2^128.
//       [4] salt        — fresh random value per bid. Generate 31 random
//                         bytes with crypto.getRandomValues and interpret
//                         them as a big-endian integer (31 bytes is always
//                         below the field modulus, so no reduction bias or
//                         out-of-range value). Never reuse across bids.
//   * Every input is a BN254 field element; pass them to the hash as BigInts
//     (or 0x-hex strings), not as strings of decimal ASCII.
//   * Onchain, the commitment is stored/emitted as bytes32 (the 32-byte
//     big-endian encoding of the field element).
//
//   Frontend reference (poseidon-lite):
//
//     import { poseidon5 } from "poseidon-lite";
//     const DOMAIN = 0x5345414c45445f4249445f5631n;
//     const salt = BigInt("0x" + [...crypto.getRandomValues(new Uint8Array(31))]
//         .map(b => b.toString(16).padStart(2, "0")).join(""));
//     const commitment = poseidon5([DOMAIN, BigInt(auctionId),
//                                   BigInt(bidderAddress), bidWei, salt]);
//
//   The bidder must persist { auctionId, bid, salt } locally (e.g. in
//   IndexedDB). Losing the salt means the bidder can never produce the proof.
//
// Why each field is there:
//   * salt              — bids live in a small, guessable domain. Without a
//                         high-entropy salt anyone could brute-force the bid
//                         from the public commitment.
//   * bidder            — the commitment and the proof are both public once
//                         posted. Without binding to the bidder, someone could
//                         copy another bidder's commitment + proof and pass
//                         the range check without knowing the bid. The
//                         contract must pass msg.sender as the `bidder`
//                         public input.
//   * auction_id        — stops a commitment/proof from one auction being
//                         replayed into another auction with the same range.
//   * COMMITMENT_DOMAIN — separates this hash from any other Poseidon hash
//                         the platform uses with the same arity.
//
// ---------------------------------------------------------------------------
// PUBLIC INPUTS (order matters — the Solidity verifier's bytes32[] must be
// built in exactly this order):
//   [0] commitment  — the bidder's stored commitment for this auction
//   [1] auction_id  — the auction id
//   [2] bidder      — msg.sender, as uint256(uint160(msg.sender))
//   [3] min_bid     — the auction's min bid (wei), read from contract storage
//   [4] max_bid     — the auction's max bid (wei), read from contract storage
// The contract must source ALL of these from its own state / msg.sender,
// never from calldata supplied by the prover.
// ---------------------------------------------------------------------------

use poseidon::poseidon::bn254::hash_5;

global COMMITMENT_DOMAIN: Field = 0x5345414c45445f4249445f5631;

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
    // Typing `bid` as u128 range-constrains it to [0, 2^128), so the
    // comparisons below are sound integer comparisons (a raw Field has no
    // ordering and would wrap around the modulus).
    let computed = hash_5([COMMITMENT_DOMAIN, auction_id, bidder, bid as Field, salt]);
    assert_eq(computed, commitment, "commitment mismatch");

    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

// ---------------------------------------------------------------------------
// Tests: `nargo test`
// ---------------------------------------------------------------------------

global TEST_AUCTION: Field = 7;
global TEST_BIDDER: Field = 0x70997970c51812dc3a010c7d01b50e0d17dc79c8;
global TEST_SALT: Field = 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f;
global MIN: u128 = 1_000_000_000_000_000_000; // 1 ETH
global MAX: u128 = 5_000_000_000_000_000_000; // 5 ETH

fn commit(bid: u128) -> Field {
    hash_5([COMMITMENT_DOMAIN, TEST_AUCTION, TEST_BIDDER, bid as Field, TEST_SALT])
}

#[test]
fn test_bid_in_range() {
    let bid: u128 = 2_500_000_000_000_000_000;
    main(bid, TEST_SALT, commit(bid), TEST_AUCTION, TEST_BIDDER, MIN, MAX);
}

#[test]
fn test_bid_at_bounds() {
    main(MIN, TEST_SALT, commit(MIN), TEST_AUCTION, TEST_BIDDER, MIN, MAX);
    main(MAX, TEST_SALT, commit(MAX), TEST_AUCTION, TEST_BIDDER, MIN, MAX);
}

#[test(should_fail_with = "bid below min_bid")]
fn test_bid_below_min() {
    let bid: u128 = MIN - 1;
    main(bid, TEST_SALT, commit(bid), TEST_AUCTION, TEST_BIDDER, MIN, MAX);
}

#[test(should_fail_with = "bid above max_bid")]
fn test_bid_above_max() {
    let bid: u128 = MAX + 1;
    main(bid, TEST_SALT, commit(bid), TEST_AUCTION, TEST_BIDDER, MIN, MAX);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_other_bidder_cannot_replay() {
    let bid: u128 = 2_500_000_000_000_000_000;
    // Same commitment + witness, but submitted by a different msg.sender.
    main(bid, TEST_SALT, commit(bid), TEST_AUCTION, TEST_BIDDER + 1, MIN, MAX);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_wrong_salt() {
    let bid: u128 = 2_500_000_000_000_000_000;
    main(bid, TEST_SALT + 1, commit(bid), TEST_AUCTION, TEST_BIDDER, MIN, MAX);
}
