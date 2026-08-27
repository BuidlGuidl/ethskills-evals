use poseidon::poseidon2::Poseidon2;

// Sealed-bid auction: prove a committed bid lies in [min_bid, max_bid]
// without revealing the bid.
//
// -------------------------------------------------------------------------
// COMMITMENT SCHEME -- what the frontend must compute
// -------------------------------------------------------------------------
//
//   commitment = Poseidon2::hash([bid, salt, auction_id, bidder], 4)
//
// All four are BN254 scalar field elements (32-byte big-endian, < p, where
//   p = 21888242871839275222246405745257275088548364400416034343698204186575808495617):
//
//   bid        bid amount in wei as an integer, must be < 2^128 (see below)
//   salt       blinding factor, fresh per bid. Sample 31 random bytes (always
//              < p). Store it: without it the bidder can never prove, and
//              leaking it reveals the bid -- bids are low-entropy, so an
//              unsalted commitment is trivially brute-forced.
//   auction_id the auction identifier held by the contract
//   bidder     the bidder's address, left-padded to 32 bytes
//
// "Poseidon2" is Barretenberg's Poseidon2 over BN254 (t=4 sponge, IV derived
// from input length) -- exactly what bb.js exposes, so JS and circuit agree
// with no extra encoding rules:
//
//   import { BarretenbergSync } from '@aztec/bb.js';
//   const bb = await BarretenbergSync.new();
//   const fr = (x) => Uint8Array.from(
//     Buffer.from(BigInt(x).toString(16).padStart(64, '0'), 'hex'));
//   const { hash } = bb.poseidon2Hash({ inputs: [
//     fr(bidWei), fr(salt), fr(auctionId), fr(bidderAddress),
//   ]});
//   const commitment = '0x' + Buffer.from(hash).toString('hex'); // bytes32
//
// Verified test vector (also asserted by `commitment_test_vector` below --
// run it in JS before shipping, and again whenever bb.js is bumped):
//   bid        = 1500000000000000000                  (1.5 ETH)
//   salt       = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd
//   auction_id = 42
//   bidder     = 0x70997970c51812dc3a010c7d01b50e0d17dc79c8
//   commitment = 0x1571d26eea8136e376d612c3d502e354e6fd6e9af51d65ecc30e42015a468211
//
// Flow:
//   1. bidding window: bidder posts `commitment` (bytes32) onchain.
//   2. window closes: bidder generates this proof in the browser.
//   3. contract calls the UltraHonk verifier, then checks the public inputs
//      against its own state: commitment == commitmentOf[msg.sender],
//      bidder == uint160(msg.sender), and auction_id / min_bid / max_bid ==
//      this auction's parameters. Those checks are not optional -- on its
//      own the proof only says "*some* commitment opens to an in-range bid".
//
// Design notes:
//   * bidder and auction_id are inside the hash so a bidder cannot re-post
//     someone else's commitment, and a commitment cannot be replayed into
//     another auction; both are public inputs so the contract can bind them.
//   * Poseidon2 over keccak256/SHA-256: those cost tens of thousands of gates
//     in-circuit, Poseidon2 costs a couple of permutations. Nothing onchain
//     recomputes the commitment, so an EVM-unfriendly hash is free here.
//     Total circuit: ~2 permutations + two 128-bit range checks, which is
//     what keeps proving viable in a phone browser.
//   * u128, not u64: bids are wei and u64 caps out at ~18.4 ETH. u128 is one
//     field element, so `bid as Field` is exact and the hash preimage in JS
//     is just the wei amount.
//
// Public inputs are emitted in declaration order; the verifier contract reads
// them as [commitment, bidder, auction_id, min_bid, max_bid].
fn main(
    // public
    commitment: pub Field,
    bidder: pub Field,
    auction_id: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    // private
    bid: u128,
    salt: Field,
) {
    // 1. the commitment opens to `bid` under `salt`, bound to bidder + auction.
    let recomputed = Poseidon2::hash([bid as Field, salt, auction_id, bidder], 4);
    assert(recomputed == commitment, "commitment mismatch");

    // 2. the range proof itself. u128 comparisons range-check the difference,
    //    so no wraparound is possible.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

#[test]
fn commitment_test_vector() {
    let bid: u128 = 1500000000000000000; // 1.5 ETH in wei
    let salt: Field = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd;
    let auction_id: Field = 42;
    let bidder: Field = 0x70997970c51812dc3a010c7d01b50e0d17dc79c8;

    let commitment = Poseidon2::hash([bid as Field, salt, auction_id, bidder], 4);
    assert_eq(
        commitment,
        0x1571d26eea8136e376d612c3d502e354e6fd6e9af51d65ecc30e42015a468211,
    );

    main(commitment, bidder, auction_id, 1000000000000000000, 10000000000000000000, bid, salt);
}

#[test]
fn accepts_bid_on_range_boundaries() {
    for bid in [1000000000000000000 as u128, 10000000000000000000 as u128] {
        let commitment = Poseidon2::hash([bid as Field, 7, 42, 1], 4);
        main(commitment, 1, 42, 1000000000000000000, 10000000000000000000, bid, 7);
    }
}

#[test(should_fail_with = "bid above max_bid")]
fn rejects_bid_above_max() {
    let bid: u128 = 20000000000000000000; // 20 ETH
    let commitment = Poseidon2::hash([bid as Field, 7, 42, 1], 4);
    main(commitment, 1, 42, 1000000000000000000, 10000000000000000000, bid, 7);
}

#[test(should_fail_with = "bid below min_bid")]
fn rejects_bid_below_min() {
    let bid: u128 = 5000000000;
    let commitment = Poseidon2::hash([bid as Field, 7, 42, 1], 4);
    main(commitment, 1, 42, 1000000000000000000, 10000000000000000000, bid, 7);
}

#[test(should_fail_with = "commitment mismatch")]
fn rejects_wrong_opening() {
    // same commitment, different claimed bid
    let commitment = Poseidon2::hash([1500000000000000000, 7, 42, 1], 4);
    main(commitment, 1, 42, 1000000000000000000, 10000000000000000000, 2000000000000000000, 7);
}

#[test(should_fail_with = "commitment mismatch")]
fn rejects_commitment_of_another_bidder() {
    let bid: u128 = 1500000000000000000;
    let commitment = Poseidon2::hash([bid as Field, 7, 42, 1], 4); // bidder 1's commitment
    main(commitment, 2, 42, 1000000000000000000, 10000000000000000000, bid, 7); // replayed by bidder 2
}
