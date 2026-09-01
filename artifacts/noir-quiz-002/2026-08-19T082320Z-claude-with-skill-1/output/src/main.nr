use poseidon::poseidon::bn254::hash_4;

// Sealed-bid auction: prove a committed bid is inside [min_bid, max_bid]
// without revealing it.
//
// COMMITMENT SCHEME — the frontend MUST reproduce this exactly.
//
//   commitment = Poseidon_bn254(4 inputs)([bid, blinding, bidder, auction_id])
//
// All four are BN254 field elements, in this order:
//   bid        bid amount in wei, as an integer < 2^128
//   blinding   a fresh 254-bit random field element, one per bid
//   bidder     the bidder's address, zero-extended to a field element
//   auction_id the auction identifier the contract stores for this sale
//
// Why each field is there:
//   - blinding: a bid is a small domain. Without a random blinding factor
//     anyone can brute-force the onchain commitment by hashing every plausible
//     wei amount. Draw it from a CSPRNG (crypto.getRandomValues), reduce it
//     mod the BN254 scalar field, and persist it next to the bid — losing it
//     means the bidder can never prove or later open their own bid.
//   - bidder + auction_id: without them a commitment can be copied by another
//     account, or replayed into a second auction with a friendlier range.
//     Both are public, so they leak nothing; they only bind the commitment.
//
// Frontend — poseidon-lite's `poseidon4` is bit-for-bit identical to this
// crate's bn254 `hash_4` (checked below). It is Poseidon, NOT Poseidon2 —
// they are different functions with different outputs, so do not substitute
// @zkpassport/poseidon2, @aztec/foundation's poseidon2, or a keccak/sha256
// commitment. Every layer (frontend, circuit, any offchain indexer) must use
// this same function and this same input order.
//
//   import { poseidon4 } from "poseidon-lite";
//
//   const bid       = 3_500_000_000_000_000_000n;        // wei, < 2^128
//   const blinding  = randomFieldElement();              // crypto.getRandomValues, mod p
//   const bidder    = BigInt(address);                   // 0x70997970... -> bigint
//   const auctionId = BigInt(id);
//   const commitment = poseidon4([bid, blinding, bidder, auctionId]);  // bigint
//   // submit `commitment` during the bidding window; persist {bid, blinding}
//   // locally (they are the only way to prove later).
//
// Checked cross-layer vector — poseidon-lite and `nargo test` both give:
//   poseidon4([
//     3500000000000000000,
//     0x1f2e3d4c5b6a798877665544332211001122334455667788990011223344556,
//     0x70997970c51812dc3a010c7d01b50e0d17dc79c8,
//     42,
//   ]) == 0x187da5832f1b674d5f189a7ccb6eeeb868ef7e1bcbd447f12bf0b1415639839d
// Re-run that comparison after any dependency bump before trusting a proof.
//
// Proving happens in the browser with NoirJS + @aztec/bb.js (UltraHonkBackend,
// `generateProof(witness, { keccak: true })`) — the default serialization does
// not verify onchain. Generate the VK feeding the Solidity verifier with
// `--oracle_hash keccak` and keep prove/verify/VK on that same setting.
//
// CONTRACT SIDE — a verifying proof only says "the preimage of THIS commitment
// is in [min_bid, max_bid]". Before accepting it the auction contract must
// check the public inputs against its own state: `commitment` is the one it
// stored for this sale, `bidder` is the account that stored it, `auction_id`
// is this auction, and `min_bid`/`max_bid` are its configured range. Do that
// after verify() returns true, and mark the commitment as proved so the same
// proof cannot be replayed.
//
// The bidder can submit this proof from their own wallet — the commitment is
// already publicly tied to their address, so a relayer would buy nothing here.
// This circuit hides the amount, not the bidder.
//
// PUBLIC INPUT ORDER is the declaration order below. The same order must be
// used by the NoirJS `publicInputs` array and by the bytes32[] the auction
// contract passes to the generated verifier's verify() — read the generated
// verifier's ABI rather than assuming it.
fn main(
    // public
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    bidder: pub Field,
    auction_id: pub Field,
    // private
    bid: u128,
    blinding: Field,
) {
    // A zero blinding factor makes the commitment brute-forceable; reject the
    // frontend bug in-circuit rather than trusting it not to happen.
    assert(blinding != 0, "blinding must be non-zero");

    // The committed value is the one being range-proved.
    let expected = hash_4([bid as Field, blinding, bidder, auction_id]);
    assert(expected == commitment, "commitment mismatch");

    // The range itself. u128 covers any wei amount (max ~3.4e38 wei); the two
    // comparisons decompose to ~128 bits each, negligible next to Poseidon.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

#[test]
fn in_range_bid_is_accepted() {
    let bid: u128 = 3_500_000_000_000_000_000;
    let blinding = 0x1f2e3d4c5b6a798877665544332211001122334455667788990011223344556;
    let bidder = 0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8;
    let auction_id = 42;
    let commitment = hash_4([bid as Field, blinding, bidder, auction_id]);

    main(
        commitment,
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
        bidder,
        auction_id,
        bid,
        blinding,
    );
}

#[test(should_fail_with = "bid below min_bid")]
fn under_min_bid_is_rejected() {
    let bid: u128 = 900_000_000_000_000_000;
    let blinding = 7777777;
    let bidder = 0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8;
    let auction_id = 42;
    let commitment = hash_4([bid as Field, blinding, bidder, auction_id]);

    main(
        commitment,
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
        bidder,
        auction_id,
        bid,
        blinding,
    );
}

#[test(should_fail_with = "commitment mismatch")]
fn different_bid_cannot_reuse_commitment() {
    let bid: u128 = 3_500_000_000_000_000_000;
    let blinding = 7777777;
    let bidder = 0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8;
    let auction_id = 42;
    let commitment = hash_4([bid as Field, blinding, bidder, auction_id]);

    main(
        commitment,
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
        bidder,
        auction_id,
        bid + 1,
        blinding,
    );
}
