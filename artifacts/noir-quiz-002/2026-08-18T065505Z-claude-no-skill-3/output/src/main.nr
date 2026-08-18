use poseidon::poseidon2::Poseidon2;

// Sealed-bid auction: prove a committed bid lies in [min_bid, max_bid],
// without revealing the bid.
//
// COMMITMENT SCHEME — the frontend must compute exactly this
// ----------------------------------------------------------
//   commitment = Poseidon2::hash([Field(bid_wei), blinding], 2)
//
//   bid_wei  : the bid in wei as an integer < 2^128 (u128 here, cast to a
//              BN254 field element before hashing).
//   blinding : a uniformly random BN254 field element, fresh per bid, secret.
//
// Poseidon2 (not keccak256) because the chain never hashes anything: the
// bidder posts `commitment` as one bytes32 during the bidding window and the
// auction contract just stores it. So the hash cost lands entirely in the
// circuit, where Poseidon2 is a few hundred gates against keccak's ~150k.
// The whole circuit is one Poseidon2 sponge plus two 128-bit comparisons,
// which keeps browser proving on a mid-range phone in the low seconds.
//
// Frontend, bidding window (bb.js — same Poseidon2 instance and sponge IV as
// this circuit, so the digests match):
//
//   import { Barretenberg, Fr } from '@aztec/bb.js';
//   const api = await Barretenberg.new();
//   const blinding = Fr.fromBufferReduce(crypto.getRandomValues(new Uint8Array(32)));
//   const commitment = await api.poseidon2Hash([new Fr(bidWei), blinding]); // bidWei: bigint
//   // send commitment.toString() (0x-prefixed bytes32) to the auction contract;
//   // persist bidWei and blinding.toString() locally — both are needed to prove
//   // now and to open the commitment at settlement.
//
// Frontend, after the window closes:
//
//   const { witness } = await noir.execute({
//     commitment: commitment.toString(),
//     min_bid: minBidWei.toString(),   // exactly the contract's values
//     max_bid: maxBidWei.toString(),
//     bid: bidWei.toString(),
//     blinding: blinding.toString(),
//   });
//   const proof = await backend.generateProof(witness, { keccak: true }); // keccak oracle => Solidity verifier
//
// Rules the frontend must honour:
//  * blinding MUST be fresh, secret, and full-width random. The bid space is
//    small enough to enumerate, so a guessable blinding (timestamp, counter,
//    address, bid index) leaks the bid outright.
//  * bid_wei < 2^128. The type enforces it inside the circuit; the UI should
//    reject larger input rather than let it wrap.
//  * Both bounds are inclusive.
//
// Onchain: public inputs reach the Solidity verifier as one bytes32 each, in
// declaration order — [0] commitment, [1] min_bid, [2] max_bid. The auction
// contract MUST check those three words against its own stored commitment and
// its own min/max before accepting the proof; otherwise a bidder can prove a
// range of their own choosing.
fn main(
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    bid: u128,
    blinding: Field,
) {
    // Bind the proof to the commitment already posted onchain.
    assert(Poseidon2::hash([bid as Field, blinding], 2) == commitment, "bad opening");

    // The range statement itself. u128 is range-checked by the type, so `bid`
    // cannot wrap around the field and fake its way into the interval.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

mod tests {
    use super::main;
    use poseidon::poseidon2::Poseidon2;

    global MIN: u128 = 1_000_000_000_000_000_000; // 1 ETH
    global MAX: u128 = 5_000_000_000_000_000_000; // 5 ETH
    global BLINDING: Field =
        0x2a3f1c9d8b7e6045132a3f1c9d8b7e6045132a3f1c9d8b7e6045132a3f1c9d8b;

    fn commit(bid: u128) -> Field {
        Poseidon2::hash([bid as Field, BLINDING], 2)
    }

    #[test]
    fn accepts_bid_inside_range() {
        let bid: u128 = 1_500_000_000_000_000_000;
        main(commit(bid), MIN, MAX, bid, BLINDING);
    }

    #[test]
    fn accepts_both_bounds() {
        main(commit(MIN), MIN, MAX, MIN, BLINDING);
        main(commit(MAX), MIN, MAX, MAX, BLINDING);
    }

    #[test(should_fail_with = "bid below min_bid")]
    fn rejects_bid_below_min() {
        let bid: u128 = MIN - 1;
        main(commit(bid), MIN, MAX, bid, BLINDING);
    }

    #[test(should_fail_with = "bid above max_bid")]
    fn rejects_bid_above_max() {
        let bid: u128 = MAX + 1;
        main(commit(bid), MIN, MAX, bid, BLINDING);
    }

    #[test(should_fail_with = "bad opening")]
    fn rejects_bid_that_is_not_the_committed_one() {
        // In range, but not the value the commitment was made to.
        let bid: u128 = 2_000_000_000_000_000_000;
        main(commit(bid), MIN, MAX, 3_000_000_000_000_000_000, BLINDING);
    }
}
