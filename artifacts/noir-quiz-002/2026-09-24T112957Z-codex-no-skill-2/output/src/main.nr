use std::hash::poseidon2_permutation;

global COMMITMENT_DOMAIN: Field = 20260924;

fn bid_commitment(bid: u128, blinding: Field) -> Field {
    poseidon2_permutation([bid as Field, blinding, 0, COMMITMENT_DOMAIN])[0]
}

// Frontend commitment rule:
// 1. Represent the bid amount as an unsigned 128-bit integer in the platform's
//    smallest bid unit, for example wei if the auction is denominated in ETH.
// 2. Sample a uniformly random non-zero BN254 scalar `blinding`.
// 3. Compute:
//      commitment = Poseidon2Permutation([bid_as_field, blinding, 0, 20260924])[0]
//    over the BN254 scalar field, using the same Poseidon2 permutation as Noir's
//    `std::hash::poseidon2_permutation`.
// 4. Publish that single field element as the onchain commitment. Later, prove
//    with the private `(bid, blinding)` witness and the public
//    `(min_bid, max_bid, commitment)` values.
fn main(
    bid: u128,
    blinding: Field,
    min_bid: pub u128,
    max_bid: pub u128,
    commitment: pub Field,
) {
    assert(min_bid <= max_bid, "invalid bid range");
    assert(blinding != 0, "invalid blinding");
    assert(bid >= min_bid, "bid below minimum");
    assert(bid <= max_bid, "bid above maximum");
    assert(bid_commitment(bid, blinding) == commitment, "invalid commitment");
}
