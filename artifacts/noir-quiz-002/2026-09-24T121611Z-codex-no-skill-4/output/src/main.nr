use std::embedded_curve_ops::EmbeddedCurvePoint;
use std::hash::pedersen_commitment;

global COMMITMENT_DOMAIN: Field = 0x7365616c65645f6269645f72616e67655f7631;

fn main(
    bid: u128,
    blinding: Field,
    auction_id: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    commitment_x: pub Field,
    commitment_y: pub Field,
) {
    assert(min_bid <= max_bid);
    assert(bid >= min_bid);
    assert(bid <= max_bid);

    // Frontend/onchain commitment recipe:
    // 1. Represent the bid as an unsigned 128-bit integer in the same base units
    //    used by min_bid and max_bid, then cast it to a BN254 scalar field element.
    // 2. Sample a fresh uniformly random BN254 field element `blinding` per bid.
    // 3. Compute Noir's Pedersen commitment over this exact field array:
    //    [COMMITMENT_DOMAIN, auction_id, bid_as_field, blinding].
    // 4. Publish/store the resulting embedded-curve point coordinates as
    //    `(commitment_x, commitment_y)`.
    let expected: EmbeddedCurvePoint = pedersen_commitment([
        COMMITMENT_DOMAIN,
        auction_id,
        bid as Field,
        blinding,
    ]);

    assert(expected.x == commitment_x);
    assert(expected.y == commitment_y);
}
