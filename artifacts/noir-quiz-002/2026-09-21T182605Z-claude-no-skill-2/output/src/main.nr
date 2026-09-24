// Sealed-bid auction: prove a committed bid lies in [min_bid, max_bid]
// without revealing it.
//
// ─── Commitment scheme (the frontend MUST compute exactly this) ─────────────
//
//   commitment = Poseidon2([DOMAIN_SEP, auction_id, bidder, bid, salt])
//
//   * Poseidon2   - the BN254 Poseidon2 sponge used by Noir/Barretenberg
//                   (t = 4, rate = 3, IV = input_length << 64). In the browser
//                   use `poseidon2Hash` from @aztec/bb.js (same bb version as
//                   the prover), passing the 5 inputs in exactly this order.
//                   Do NOT use circomlib's Poseidon - different permutation.
//   * DOMAIN_SEP  - 0x7365616c65645f6269645f7631 (ASCII "sealed_bid_v1"),
//                   the constant below.
//   * auction_id  - the auction's id as stored onchain (uint256 < BN254 field
//                   modulus; a sequential counter is fine).
//   * bidder      - the bidder's Ethereum address as a field element, i.e.
//                   uint256(uint160(msg.sender)).
//   * bid         - the bid in wei, as an unsigned integer < 2^128.
//   * salt        - 31 bytes from crypto.getRandomValues, big-endian → Field.
//                   (31 bytes guarantees salt < field modulus, so no silent
//                   reduction.) A fresh salt per bid; store it locally - the
//                   bid cannot be proven without it. The salt is what makes
//                   the commitment hiding: bids are low-entropy and would
//                   otherwise be brute-forced from the onchain commitment.
//
//   Each value is passed to bb.js as a Fr / 32-byte big-endian hex string.
//
// Why auction_id and bidder are bound into the commitment:
//   Proofs are public once submitted. Without `bidder`, anyone could copy a
//   rival's commitment during the bidding window and later replay the rival's
//   proof as their own. Without `auction_id`, a commitment + proof from one
//   auction could be replayed in another.
//
// ─── What the verifying contract MUST do ────────────────────────────────────
//   Build the public inputs itself; never take them from the caller:
//     commitment = commitments[auction_id][msg.sender]   (stored at bid time)
//     min_bid, max_bid = auction's stored bounds
//     auction_id = the auction being settled
//     bidder = msg.sender
//   Public input order for the verifier (bytes32[]) is the parameter order of
//   `main` below: commitment, min_bid, max_bid, auction_id, bidder.

use poseidon::poseidon2::Poseidon2;

global DOMAIN_SEP: Field = 0x7365616c65645f6269645f7631; // "sealed_bid_v1"

pub fn commit(auction_id: Field, bidder: Field, bid: u128, salt: Field) -> Field {
    Poseidon2::hash([DOMAIN_SEP, auction_id, bidder, bid as Field, salt], 5)
}

fn main(
    // private
    bid: u128,
    salt: Field,
    // public
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    auction_id: pub Field,
    bidder: pub Field,
) {
    // `bid: u128` is range-checked to < 2^128 by the type itself, so
    // `bid as Field` cannot wrap and the comparisons below are sound.
    assert(commit(auction_id, bidder, bid, salt) == commitment, "commitment mismatch");
    assert(bid >= min_bid, "bid below min");
    assert(bid <= max_bid, "bid above max");
}

// ─── Tests ──────────────────────────────────────────────────────────────────

global AUCTION: Field = 7;
global BIDDER: Field = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
global SALT: Field = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd;
global MIN: u128 = 1_000_000_000_000_000_000; // 1 ETH
global MAX: u128 = 10_000_000_000_000_000_000; // 10 ETH

#[test]
fn test_in_range() {
    let bid: u128 = 2_500_000_000_000_000_000;
    main(bid, SALT, commit(AUCTION, BIDDER, bid, SALT), MIN, MAX, AUCTION, BIDDER);
}

#[test]
fn test_bounds_inclusive() {
    main(MIN, SALT, commit(AUCTION, BIDDER, MIN, SALT), MIN, MAX, AUCTION, BIDDER);
    main(MAX, SALT, commit(AUCTION, BIDDER, MAX, SALT), MIN, MAX, AUCTION, BIDDER);
}

#[test(should_fail_with = "bid below min")]
fn test_below_min() {
    let bid = MIN - 1;
    main(bid, SALT, commit(AUCTION, BIDDER, bid, SALT), MIN, MAX, AUCTION, BIDDER);
}

#[test(should_fail_with = "bid above max")]
fn test_above_max() {
    let bid = MAX + 1;
    main(bid, SALT, commit(AUCTION, BIDDER, bid, SALT), MIN, MAX, AUCTION, BIDDER);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_wrong_opening() {
    let c = commit(AUCTION, BIDDER, MIN, SALT);
    main(MIN + 1, SALT, c, MIN, MAX, AUCTION, BIDDER);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_replay_by_other_bidder() {
    // Attacker copies the victim's commitment; proof bound to the victim fails
    // when the contract supplies the attacker's address as `bidder`.
    let c = commit(AUCTION, BIDDER, MIN, SALT);
    main(MIN, SALT, c, MIN, MAX, AUCTION, 0xdead);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_replay_other_auction() {
    let c = commit(AUCTION, BIDDER, MIN, SALT);
    main(MIN, SALT, c, MIN, MAX, AUCTION + 1, BIDDER);
}
