use poseidon::poseidon::bn254::hash_2;

// Frontend commitment scheme:
// 1. Choose a uniformly random private `salt` as a BN254 field element.
// 2. Encode `bid` as a u128 integer in the same unit as `min_bid` and `max_bid`
//    (for example, wei). Reject bids outside u128 before proving.
// 3. Compute `bid_secret = PoseidonBN254.hash_2([Field::from(bid), salt])`.
// 4. Compute `commitment = PoseidonBN254.hash_2([auction_id, bid_secret])`.
// 5. Publish exactly that `commitment` onchain during the bidding window, and
//    later use the same `auction_id`, `bid`, and `salt` as proof inputs.
fn main(
    bid: u128,
    salt: Field,
    auction_id: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    commitment: pub Field,
) {
    assert(min_bid <= max_bid, "invalid bid range");
    assert(bid >= min_bid, "bid below minimum");
    assert(bid <= max_bid, "bid above maximum");

    let bid_secret = hash_2([bid as Field, salt]);
    let computed_commitment = hash_2([auction_id, bid_secret]);

    assert(computed_commitment == commitment, "commitment mismatch");
}
