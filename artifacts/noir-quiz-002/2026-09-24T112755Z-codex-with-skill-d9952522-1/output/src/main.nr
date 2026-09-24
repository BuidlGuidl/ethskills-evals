use poseidon::poseidon::bn254::hash_2;

// Frontend commitment rule:
// 1. Express the bid amount in the auction's smallest unit as an unsigned
//    integer that fits in u128, and pass the exact same value as `bid_amount`.
// 2. Generate `blinding` as a fresh, uniformly random BN254 scalar Field for
//    this bid. Never derive it from the bid or reuse it across commitments.
// 3. Compute the onchain commitment as:
//      commitment = Poseidon_BN254_hash_2([bid_amount_as_Field, blinding])
//    using the same Poseidon implementation as Noir's
//    `poseidon::poseidon::bn254::hash_2`, with the bid first and blinding
//    second.
fn main(
    bid_amount: u128,
    blinding: Field,
    min_bid: pub u128,
    max_bid: pub u128,
    commitment: pub Field,
) {
    assert(min_bid <= max_bid);
    assert(bid_amount >= min_bid);
    assert(bid_amount <= max_bid);

    let computed_commitment = hash_2([bid_amount as Field, blinding]);
    assert(computed_commitment == commitment);
}
