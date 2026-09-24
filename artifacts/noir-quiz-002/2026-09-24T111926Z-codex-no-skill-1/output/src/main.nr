use std::hash::poseidon2_permutation;

global COMMITMENT_DOMAIN: Field = 1;

// Frontend commitment rule:
// 1. Represent the bid amount as an unsigned 128-bit integer in the auction's
//    smallest unit, for example wei. It must be in [0, 2^128 - 1].
// 2. Sample `salt` uniformly as a BN254 scalar field element.
// 3. Compute Noir/Barretenberg's BN254 Poseidon2 permutation on the 4-field
//    state `[1, bid_as_field, salt, 0]`, where `1` is this circuit's domain
//    separator, then set `commitment = output_state[0]`.
// 4. Publish that field element onchain as the bid commitment. This is not a
//    Keccak hash; the frontend must use the same BN254 Poseidon2 permutation
//    parameters as Noir's `std::hash::poseidon2_permutation`.
fn main(
    bid: u128,
    salt: Field,
    min_bid: pub u128,
    max_bid: pub u128,
    commitment: pub Field,
) {
    assert(min_bid <= max_bid);
    assert(bid >= min_bid);
    assert(bid <= max_bid);

    let commitment_state =
        poseidon2_permutation([COMMITMENT_DOMAIN, bid as Field, salt, 0]);
    let expected_commitment = commitment_state[0];
    assert(expected_commitment == commitment);
}
