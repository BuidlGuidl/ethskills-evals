use poseidon::poseidon::bn254::hash_2;

fn main(
    bid: u64,
    blinding: Field,
    commitment: pub Field,
    min_bid: pub u64,
    max_bid: pub u64,
) {
    // Frontend commitment rule:
    // choose bid as a u64 amount and blinding as a uniformly random BN254 field
    // element, then publish Poseidon BN254 hash_2([bid as Field, blinding]).
    // The input order and hash function must match this circuit exactly.
    let computed_commitment = hash_2([bid as Field, blinding]);

    assert(computed_commitment == commitment);
    assert(max_bid >= min_bid);
    assert(bid >= min_bid);
    assert(bid <= max_bid);
}
