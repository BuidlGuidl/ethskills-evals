use poseidon::poseidon::bn254::hash_4;

global BID_COMMITMENT_DOMAIN: Field = 1;

fn main(
    bid_amount: u128,
    bid_blinding: Field,
    commitment: pub Field,
    auction_id: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // Frontend commitment recipe:
    // - Interpret bid_amount, min_bid, and max_bid as unsigned 128-bit integer wei values.
    // - Generate bid_blinding as a uniformly random BN254 field element and keep it private.
    // - Compute commitment with the same BN254 Poseidon implementation used by
    //   noir-lang/poseidon hash_4:
    //   commitment = Poseidon_BN254([1, auction_id, bid_amount, bid_blinding]).
    //   The leading 1 is this circuit's domain separator. Do not use keccak256,
    //   Poseidon2, packed ABI bytes, or a different input order.
    let computed_commitment = hash_4([
        BID_COMMITMENT_DOMAIN,
        auction_id,
        bid_amount as Field,
        bid_blinding,
    ]);

    assert(computed_commitment == commitment, "Invalid bid commitment");
    assert(min_bid <= max_bid, "Invalid auction range");
    assert(bid_amount >= min_bid, "Bid below minimum");
    assert(bid_amount <= max_bid, "Bid above maximum");
}
