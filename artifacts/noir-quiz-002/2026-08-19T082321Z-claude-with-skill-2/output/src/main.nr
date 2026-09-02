use poseidon::poseidon::bn254::hash_3;

// Sealed-bid auction — range proof over a hiding commitment to the bid.
//
// Bidding window : bidder posts `commitment` onchain (see below).
// After close    : bidder proves min_bid <= bid <= max_bid without revealing
//                  `bid`, against the commitment the contract already stored.
//
// ---------------------------------------------------------------------------
// COMMITMENT SCHEME — what the frontend must compute
// ---------------------------------------------------------------------------
//
//   commitment = Poseidon_BN254([ bid, blinding, bidder ])
//
//   bid       amount in GWEI, integer, 0 <= bid < 2^64.
//             Gwei not wei: wei overflows u64 at ~18.4 ETH. 2^64 gwei is
//             ~1.8e10 ETH, so the ceiling is irrelevant. The contract must
//             read min_bid/max_bid and the settlement payment in the SAME
//             unit, or a bidder proves a range they never funded.
//   blinding   uniformly random Field, freshly drawn per bid:
//                 crypto.getRandomValues -> reduce mod the BN254 scalar field
//             MANDATORY. A bid lives in a tiny domain (round ETH amounts);
//             without a blinding factor anyone grinds the onchain commitment
//             back to the amount in seconds and the auction is not sealed.
//   bidder     the bidder's Ethereum address, as a Field (the 20-byte address
//             as a big-endian integer — `BigInt(address)`; it fits in 254 bits).
//             Binds the proof to one account: copying someone else's
//             commitment gets you a commitment you cannot prove.
//
// Frontend (must produce byte-identical output to `hash_3` above):
//
//   import { poseidon3 } from "poseidon-lite";           // circomlib BN254 params
//   const commitment = poseidon3([bidGwei, blinding, BigInt(bidderAddress)]);
//
// The bidder MUST persist { bid, blinding } locally at commit time. They are
// the only witness to the commitment — lose them and the bid can be neither
// proved in range here nor revealed at settlement, and the deposit is stuck.
//
// Before wiring any of this up, check ONE vector across all three layers
// (this circuit's `commitment_matches_frontend_vector` test, the JS helper,
// and whatever the contract/indexer recomputes). Poseidon and Poseidon2 are
// different functions and produce different digests for the same inputs;
// `poseidon-lite`'s `poseidon3` is the one that matches
// `poseidon::poseidon::bn254::hash_3`. A mismatch here is silent until a
// real bidder cannot prove.
//
// ---------------------------------------------------------------------------
// Public inputs are ordered exactly as declared. The generated Solidity
// verifier takes them as one bytes32[] in this order:
//   [commitment, min_bid, max_bid, bidder]
// Read the generated verifier's ABI rather than trusting this comment, and
// have the auction contract supply min_bid/max_bid/bidder itself — bidder from
// the stored commitment record, NOT from calldata, or the binding is decorative.
fn main(
    commitment: pub Field,
    min_bid: pub u64,
    max_bid: pub u64,
    bidder: pub Field,
    bid: u64,
    blinding: Field,
) {
    // 1. The prover knows an opening of the committed bid.
    //    `bid` is typed u64, so Noir range-constrains it to 64 bits here; the
    //    comparisons below cannot be skipped by an over-large field element.
    let recomputed = hash_3([bid as Field, blinding, bidder]);
    assert(recomputed == commitment, "commitment does not open to (bid, blinding, bidder)");

    // 2. That bid sits inside the auction's allowed range. u64 comparison is a
    //    couple of range constraints; comparing Fields would decompose 254 bits
    //    each and cost far more on a phone.
    assert(bid >= min_bid, "bid below auction minimum");
    assert(bid <= max_bid, "bid above auction maximum");
}

#[test]
fn accepts_bid_inside_range() {
    let bid: u64 = 1_500_000_000; // 1.5 ETH in gwei
    let blinding = 0x1f2e3d4c5b6a798877665544332211009988aabbccddeeff0011223344556677;
    let bidder = 0x00a0Ee7A142d267C1f36714E4a8F75612F20a79720;
    let commitment = hash_3([bid as Field, blinding, bidder]);

    main(commitment, 1_000_000_000, 5_000_000_000, bidder, bid, blinding);
}

#[test]
fn accepts_bid_on_both_boundaries() {
    let blinding = 7;
    let bidder = 0x00a0Ee7A142d267C1f36714E4a8F75612F20a79720;

    let lo: u64 = 1_000_000_000;
    main(hash_3([lo as Field, blinding, bidder]), lo, 5_000_000_000, bidder, lo, blinding);

    let hi: u64 = 5_000_000_000;
    main(hash_3([hi as Field, blinding, bidder]), 1_000_000_000, hi, bidder, hi, blinding);
}

#[test(should_fail_with = "bid below auction minimum")]
fn rejects_bid_under_minimum() {
    let bid: u64 = 999_999_999;
    let blinding = 42;
    let bidder = 0x00a0Ee7A142d267C1f36714E4a8F75612F20a79720;
    let commitment = hash_3([bid as Field, blinding, bidder]);

    main(commitment, 1_000_000_000, 5_000_000_000, bidder, bid, blinding);
}

#[test(should_fail_with = "bid above auction maximum")]
fn rejects_bid_over_maximum() {
    let bid: u64 = 5_000_000_001;
    let blinding = 42;
    let bidder = 0x00a0Ee7A142d267C1f36714E4a8F75612F20a79720;
    let commitment = hash_3([bid as Field, blinding, bidder]);

    main(commitment, 1_000_000_000, 5_000_000_000, bidder, bid, blinding);
}

#[test(should_fail_with = "commitment does not open to")]
fn rejects_in_range_bid_against_someone_elses_commitment() {
    // Copying another bidder's onchain commitment yields nothing: the address
    // is inside the preimage, so the copier cannot open it.
    let bid: u64 = 2_000_000_000;
    let blinding = 42;
    let victim = 0x00a0Ee7A142d267C1f36714E4a8F75612F20a79720;
    let attacker = 0x00b1Ff8B253e378D2f47825F5b9F86723F31b8a831;
    let commitment = hash_3([bid as Field, blinding, victim]);

    main(commitment, 1_000_000_000, 5_000_000_000, attacker, bid, blinding);
}
