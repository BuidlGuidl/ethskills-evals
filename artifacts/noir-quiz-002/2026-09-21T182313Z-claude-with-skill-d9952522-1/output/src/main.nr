use poseidon::poseidon::bn254::hash_4;

// Sealed-bid auction: prove the bid behind an onchain commitment lies in
// [min_bid, max_bid] without revealing it.
//
// COMMITMENT SCHEME — the frontend must compute exactly:
//
//     commitment = Poseidon([bid, salt, auction_id, bidder])
//
//   * Poseidon over BN254, circomlib-compatible parameters (t = 5, 4 inputs),
//     inputs in exactly this order. In JS: `poseidon4([bid, salt, auctionId, bidder])`
//     from `poseidon-lite` (or circomlibjs `buildPoseidon()`). NOT Poseidon2,
//     NOT keccak — different functions, different outputs.
//   * bid        — amount in wei as a BigInt, must be < 2^128.
//   * salt       — fresh random blinding factor per bid: 31 random bytes from
//                  crypto.getRandomValues, as a BigInt (always < field modulus).
//                  Without it the bid is brute-forceable from the commitment.
//                  The bidder MUST persist (bid, salt) locally until proving;
//                  losing the salt means the bid can never be proven.
//   * auction_id — the auction's onchain id (uint256 < field modulus).
//                  Stops a commitment/proof being reused across auctions.
//   * bidder     — the bidder's 20-byte address as a BigInt (BigInt(address)).
//                  Stops someone copying another bidder's commitment and
//                  replaying that bidder's proof as their own.
//   Submit `commitment` onchain as bytes32 / uint256 during the bidding window.
//
// VERIFIER CONTRACT must build the public inputs itself, in this order:
//   [commitment, auction_id, bidder, min_bid, max_bid]
// taking commitment from its own storage (keyed by auction and bidder) and
// min_bid / max_bid from the auction's config — never from calldata.
fn main(
    bid: u128,
    salt: Field,
    commitment: pub Field,
    auction_id: pub Field,
    bidder: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // `bid` is typed u128 so the ABI range-constrains it; a Field bid would
    // wrap around the modulus and make the comparisons meaningless.
    assert(hash_4([bid as Field, salt, auction_id, bidder]) == commitment);
    assert(bid >= min_bid);
    assert(bid <= max_bid);
}

#[test]
fn test_bid_in_range() {
    let bid: u128 = 1_500_000_000_000_000_000; // 1.5 ETH
    let salt = 0x1234567890abcdef;
    let c = hash_4([bid as Field, salt, 7, 0xdead]);
    main(bid, salt, c, 7, 0xdead, 1_000_000_000_000_000_000, 2_000_000_000_000_000_000);
}

#[test]
fn test_bid_at_bounds() {
    let salt = 42;
    let c_lo = hash_4([100, salt, 1, 2]);
    main(100, salt, c_lo, 1, 2, 100, 200);
    let c_hi = hash_4([200, salt, 1, 2]);
    main(200, salt, c_hi, 1, 2, 100, 200);
}

#[test(should_fail)]
fn test_bid_below_min() {
    let c = hash_4([99, 42, 1, 2]);
    main(99, 42, c, 1, 2, 100, 200);
}

#[test(should_fail)]
fn test_bid_above_max() {
    let c = hash_4([201, 42, 1, 2]);
    main(201, 42, c, 1, 2, 100, 200);
}

#[test(should_fail)]
fn test_wrong_commitment() {
    let c = hash_4([150, 42, 1, 2]);
    main(150, 43, c, 1, 2, 100, 200);
}

#[test(should_fail)]
fn test_other_bidder_cannot_reuse_commitment() {
    let c = hash_4([150, 42, 1, 2]);
    main(150, 42, c, 1, 3, 100, 200);
}

// Cross-layer vector: poseidon-lite `poseidon4([100n, 42n, 1n, 2n])` returns this value.
#[test]
fn test_matches_frontend_vector() {
    assert(
        hash_4([100, 42, 1, 2])
            == 0x24eb0d0ebefe4fa59f6fec4f36db9feae6f201f33aef01a40ab7164eb1c5f426,
    );
}
