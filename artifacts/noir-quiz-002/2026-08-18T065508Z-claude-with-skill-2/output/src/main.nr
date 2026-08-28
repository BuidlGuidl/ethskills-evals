//! Sealed-bid auction: range proof over a committed bid.
//!
//! Bidding window : bidder publishes `commitment` onchain (nothing else).
//! After close    : bidder proves `min_bid <= bid <= max_bid` for that exact
//!                  commitment, without revealing `bid`. No reveal ever happens.
//!
//! ---------------------------------------------------------------------------
//! COMMITMENT SCHEME — how the frontend MUST compute it
//! ---------------------------------------------------------------------------
//!   commitment = Poseidon2::hash([DOMAIN, auction_id, bid, blinding], 4)
//!
//! Poseidon2 here is Barretenberg's Poseidon2 over BN254 — the exact same
//! implementation exposed by `@aztec/bb.js`, which the frontend already loads
//! for proving. So the frontend computes the commitment with that library and
//! parity is guaranteed by construction (do NOT substitute circomlib's
//! Poseidon(v1), Poseidon2 from another lib, or keccak — different outputs).
//!
//!   import { Barretenberg, Fr } from "@aztec/bb.js";
//!
//!   const DOMAIN   = 0x4e46545f5345414c45445f4249445f5631n; // ascii "NFT_SEALED_BID_V1"
//!   const bb       = await Barretenberg.new();
//!   // blinding: uniform 254-bit random, < BN254 field modulus. Never reuse it,
//!   // never derive it from the bid. Persist it with the bid — losing it means
//!   // the bidder can never prove their range and the bid is dead.
//!   const blinding = Fr.random();
//!
//!   const commitment = await bb.poseidon2Hash([
//!     new Fr(DOMAIN),          // 1. domain tag, fixed constant below
//!     new Fr(BigInt(auctionId)),// 2. auction id, same value the contract stores
//!     new Fr(bidWei),          // 3. bid in wei, must be < 2^128
//!     blinding,                // 4. secret blinding factor
//!   ]);
//!   // commitment.toString() -> 0x-prefixed bytes32, publish this onchain.
//!
//! Element order is part of the scheme: any permutation produces a different
//! hash and the proof will not verify.
//!
//! Why each element:
//!  - DOMAIN     : domain separation, so a bid commitment can never be replayed
//!                 as some other Poseidon2 hash in the protocol.
//!  - auction_id : binds the commitment to one auction. Without it the same
//!                 commitment (and proof) is replayable into another auction
//!                 with a wider [min_bid, max_bid].
//!  - bid        : the committed value.
//!  - blinding   : hiding. Bid amounts are low entropy — a bounded range plus a
//!                 round-number habit makes an unblinded commitment brute
//!                 forceable in seconds. This field is what makes it sealed.
//!
//! ---------------------------------------------------------------------------
//! ONCHAIN
//! ---------------------------------------------------------------------------
//! Public inputs are passed to the generated HonkVerifier in this exact order:
//!   [commitment, auction_id, min_bid, max_bid]
//! The auction contract must supply `auction_id`, `min_bid`, `max_bid` from its
//! own storage (never from calldata the bidder controls) and must check that
//! `commitment` is the one that bidder published during the bidding window.
//! The proof only says "this commitment opens to a value in range" — everything
//! about *whose* commitment it is comes from contract state.

use poseidon::poseidon2::Poseidon2;

/// ascii "NFT_SEALED_BID_V1", big-endian. Frontend must use the same constant.
global DOMAIN: Field = 0x4e46545f5345414c45445f4249445f5631;

fn main(
    // --- private ---
    bid: u128,       // bid in wei; u128 caps it well above any realistic ETH amount
    blinding: Field, // secret, generated at commit time, persisted by the bidder
    // --- public ---
    commitment: pub Field,
    auction_id: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // 1. Open the commitment. This is the only thing tying the proof to the
    //    value the bidder published onchain during the bidding window.
    let computed = Poseidon2::hash([DOMAIN, auction_id, bid as Field, blinding], 4);
    assert(computed == commitment, "commitment does not open to this bid");

    // 2. Range. u128 comparisons are range constraints on the difference, so
    //    `bid` is inherently bounded to 128 bits and cannot wrap the field.
    assert(bid >= min_bid, "bid below auction minimum");
    assert(bid <= max_bid, "bid above auction maximum");
}

#[test]
fn accepts_bid_inside_range() {
    let bid: u128 = 3_500_000_000_000_000_000; // 3.5 ETH
    let blinding = 0x2b1f0e5d7c93a4816fd25c30e9b7a4418c5d6e2f019a3b7c4d5e6f70819a2b3c;
    let auction_id = 42;
    let commitment = Poseidon2::hash([DOMAIN, auction_id, bid as Field, blinding], 4);

    main(
        bid,
        blinding,
        commitment,
        auction_id,
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
    );
}

#[test]
fn accepts_bid_on_boundaries() {
    let blinding = 0x0a1;
    let auction_id = 7;
    let min: u128 = 1_000_000_000_000_000_000;
    let max: u128 = 2_000_000_000_000_000_000;

    for bid in [min, max] {
        let commitment = Poseidon2::hash([DOMAIN, auction_id, bid as Field, blinding], 4);
        main(bid, blinding, commitment, auction_id, min, max);
    }
}

#[test(should_fail_with = "bid below auction minimum")]
fn rejects_bid_below_range() {
    let bid: u128 = 999_999_999_999_999_999;
    let blinding = 0x0a1;
    let auction_id = 7;
    let commitment = Poseidon2::hash([DOMAIN, auction_id, bid as Field, blinding], 4);
    main(bid, blinding, commitment, auction_id, 1_000_000_000_000_000_000, 2_000_000_000_000_000_000);
}

#[test(should_fail_with = "bid above auction maximum")]
fn rejects_bid_above_range() {
    let bid: u128 = 2_000_000_000_000_000_001;
    let blinding = 0x0a1;
    let auction_id = 7;
    let commitment = Poseidon2::hash([DOMAIN, auction_id, bid as Field, blinding], 4);
    main(bid, blinding, commitment, auction_id, 1_000_000_000_000_000_000, 2_000_000_000_000_000_000);
}

/// An in-range bid cannot be swapped in against someone else's commitment.
#[test(should_fail_with = "commitment does not open to this bid")]
fn rejects_wrong_commitment() {
    let bid: u128 = 1_500_000_000_000_000_000;
    let blinding = 0x0a1;
    let commitment = Poseidon2::hash([DOMAIN, 7, bid as Field, blinding], 4);
    // same commitment, different auction -> must not verify
    main(bid, blinding, commitment, 8, 1_000_000_000_000_000_000, 2_000_000_000_000_000_000);
}

