use poseidon::poseidon::bn254::hash_2;

// The frontend must compute the onchain commitment as:
//   commitment = PoseidonHash2([bid_amount_as_field, bid_blinding])
// where PoseidonHash2 is poseidon::poseidon::bn254::hash_2, bid_amount_as_field
// is the exact u128 bid amount cast into BN254 Field, and bid_blinding is a
// uniformly random BN254 Field kept private by the bidder. The input order is
// exactly [bid_amount, bid_blinding].
fn main(
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    bid_amount: u128,
    bid_blinding: Field,
) {
    assert(min_bid <= max_bid);
    assert(bid_amount >= min_bid);
    assert(bid_amount <= max_bid);

    let computed_commitment = hash_2([bid_amount as Field, bid_blinding]);
    assert(computed_commitment == commitment);
}
