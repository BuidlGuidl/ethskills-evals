use poseidon::poseidon::bn254::hash_2;

fn main(bid: u128, blinding: Field, commitment: pub Field, min_bid: pub u128, max_bid: pub u128) {
    // Frontend commitment calculation:
    // 1. Encode the bid amount in wei as an unsigned 128-bit integer. Reject bids
    //    outside [0, 2^128 - 1] before proving.
    // 2. Generate `blinding` as a fresh uniformly random BN254 field element and
    //    keep it private with the bid.
    // 3. Publish `commitment = Poseidon_BN254_hash_2([bid_as_field, blinding])`,
    //    using the same Poseidon implementation as Noir's
    //    `poseidon::poseidon::bn254::hash_2`.
    let computed_commitment = hash_2([bid as Field, blinding]);

    assert(computed_commitment == commitment, "Invalid commitment");
    assert(min_bid <= bid, "Bid is below minimum");
    assert(bid <= max_bid, "Bid is above maximum");
}
