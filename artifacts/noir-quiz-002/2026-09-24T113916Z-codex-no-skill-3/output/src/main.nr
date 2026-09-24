use std::hash::poseidon2_permutation;

// Frontend commitment rule:
// 1. Encode the bid as a u64 integer, then lift it to the BN254 scalar field.
// 2. Sample `salt` uniformly as a BN254 scalar field element.
// 3. Compute the BN254 Poseidon2 permutation over the 4-field state
//    `[bid_as_field, salt, 0, 2 << 64]`, where `2 << 64` is the sponge IV
//    for exactly two absorbed field elements.
// 4. The commitment is `permuted_state[0]`.
// 5. Publish `commitment` onchain as a uint256 strictly less than the BN254
//    scalar field modulus. Keep `bid` and `salt` private for proof generation.
fn main(
    commitment: pub Field,
    min_bid: pub u64,
    max_bid: pub u64,
    bid: u64,
    salt: Field,
) {
    assert(min_bid <= max_bid);
    assert(bid >= min_bid);
    assert(bid <= max_bid);

    let iv: Field = 36893488147419103232; // 2 << 64
    let computed_commitment = poseidon2_permutation([bid as Field, salt, 0, iv])[0];
    assert(computed_commitment == commitment);
}
