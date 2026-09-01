use poseidon::poseidon2::Poseidon2;

// Sealed-bid auction range proof.
//
//   Bidding window : bidder publishes `commitment` (a bytes32) onchain.
//   After it closes: bidder proves the committed amount lies in
//                    [min_bid, max_bid] without revealing it. Nothing is ever
//                    opened in the clear.
//
// ===========================================================================
// COMMITMENT SCHEME — the frontend MUST compute it exactly like this
// ===========================================================================
//
//   commitment = poseidon2([ bid, blinding, bidder ])      // 3 field inputs
//
//   bid      : bid amount in wei as a BN254 field element. Must fit in 128
//              bits (< 2^128 wei, i.e. < ~3.4e20 ETH) — the circuit
//              range-checks this via the `u128` type.
//   blinding : uniformly random BN254 field element (32 bytes of CSPRNG
//              entropy, rejection-sampled below p). This is the *only* thing
//              hiding the bid: poseidon2 over a bare amount is brute-forceable
//              in milliseconds. Never reuse one, and persist it — without it
//              the bidder can no longer prove anything about their own bid.
//   bidder   : the bidder's Ethereum address as a field element (160 bits,
//              always fits). Binds the commitment to its owner, so a griefer
//              cannot copy someone else's published commitment.
//
//   BN254 field order p =
//     21888242871839275222246405745257275088548364400416034343698204186575808495617
//
// --- Reference frontend ------------------------------------------------------
//
//   npm i @zkpassport/poseidon2   // pure JS, same Poseidon2 params as this
//                                 // circuit and as barretenberg — no wasm,
//                                 // instant on a phone
//
//   import { poseidon2Hash } from '@zkpassport/poseidon2';
//
//   const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
//
//   function randomBlinding() {                      // rejection sample < p
//     for (;;) {
//       const b = crypto.getRandomValues(new Uint8Array(32));
//       const v = BigInt('0x' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''));
//       if (v < P) return v;
//     }
//   }
//
//   const blinding = randomBlinding();               // STORE THIS
//   const commitment = poseidon2Hash([
//     bidWei,                                        // bigint
//     blinding,                                      // bigint
//     BigInt(bidderAddress),                         // '0x..' -> bigint
//   ]);
//   const commitmentBytes32 = '0x' + commitment.toString(16).padStart(64, '0');
//
//   Send `commitmentBytes32` to the auction contract during the bidding
//   window. To prove later, feed the same values back as the witness:
//     public : commitment, bidder, min_bid, max_bid
//     private: bid, blinding
//
//   Cross-check vector (verified against this circuit):
//     poseidon2([1, 2, 3])
//       = 0x23864adb160dddf590f1d3303683ebcb914f828e2635f6e85a32f0a1aecd3dd8
//   Assert this in a frontend unit test — it is the whole compatibility
//   surface between the browser and the circuit.
//
// ===========================================================================
// Notes for the verifier contract
// ===========================================================================
// * Public inputs are passed to the Honk verifier in the parameter order
//   below: [commitment, bidder, min_bid, max_bid].
// * The contract must check `bidder == msg.sender` (or the address recorded
//   with that commitment) and `commitment == the one stored during the
//   bidding window`, otherwise a proof about someone else's commitment, or an
//   unrelated commitment, would pass.
// * `min_bid` / `max_bid` are public so the contract can pin them to the
//   auction's configured range. Both bounds are inclusive, in wei.
// * The chain never computes poseidon2 — it only stores the commitment and
//   runs the verifier — so an EVM-unfriendly hash costs nothing here.
//
// Cost: one poseidon2 sponge + a 128-bit range check + two comparisons.
// ~2.9k UltraHonk gates, versus ~29k for the same circuit with pedersen and
// far more with sha256/keccak. That is the difference between a snappy proof
// and a stalled tab on a mid-range phone.

fn main(
    // --- public ---
    commitment: pub Field, // published onchain during the bidding window
    bidder: pub Field, // must equal msg.sender in the verifier contract
    min_bid: pub u128, // wei, inclusive
    max_bid: pub u128, // wei, inclusive
    // --- private ---
    bid: u128, // wei; the u128 type range-constrains it for free
    blinding: Field, // the secret nonce from the commit step
) {
    // 1. The prover knows an opening of the published commitment.
    let recomputed = Poseidon2::hash([bid as Field, blinding, bidder], 3);
    assert(recomputed == commitment, "commitment does not open to (bid, blinding, bidder)");

    // 2. That opening lies inside the auction's allowed range.
    //    `bid` is already known to be < 2^128 from its type, so these are
    //    plain bounded comparisons, not full field range decompositions.
    assert(bid >= min_bid, "bid below auction minimum");
    assert(bid <= max_bid, "bid above auction maximum");
}

// ---------------------------------------------------------------------------

global MIN: u128 = 1_000_000_000_000_000_000; // 1 ETH
global MAX: u128 = 10_000_000_000_000_000_000; // 10 ETH
global BIDDER: Field = 0x00000000000000000000000000000000deadbeef;

fn commit(bid: u128, blinding: Field, bidder: Field) -> Field {
    Poseidon2::hash([bid as Field, blinding, bidder], 3)
}

#[test]
fn accepts_bid_inside_range() {
    let bid: u128 = 5_000_000_000_000_000_000;
    let blinding = 0x1f3b7c9d2a4e6081b5d3f7a9c1e5038d6b2f4a8c0e7d9b1f3a5c7e9d0b2f4a6;
    main(
        commit(bid, blinding, BIDDER),
        BIDDER,
        MIN,
        MAX,
        bid,
        blinding,
    );
}

#[test]
fn accepts_bids_on_both_boundaries() {
    let blinding = 42;
    main(
        commit(MIN, blinding, BIDDER),
        BIDDER,
        MIN,
        MAX,
        MIN,
        blinding,
    );
    main(
        commit(MAX, blinding, BIDDER),
        BIDDER,
        MIN,
        MAX,
        MAX,
        blinding,
    );
}

#[test(should_fail_with = "bid below auction minimum")]
fn rejects_bid_under_minimum() {
    let bid: u128 = 999_999_999_999_999_999;
    main(commit(bid, 7, BIDDER), BIDDER, MIN, MAX, bid, 7);
}

#[test(should_fail_with = "bid above auction maximum")]
fn rejects_bid_over_maximum() {
    let bid: u128 = 10_000_000_000_000_000_001;
    main(commit(bid, 7, BIDDER), BIDDER, MIN, MAX, bid, 7);
}

#[test(should_fail_with = "commitment does not open to")]
fn rejects_lying_about_the_committed_amount() {
    let bid: u128 = 5_000_000_000_000_000_000;
    let c = commit(bid, 7, BIDDER);
    main(c, BIDDER, MIN, MAX, 4_000_000_000_000_000_000, 7);
}

#[test(should_fail_with = "commitment does not open to")]
fn rejects_someone_elses_commitment() {
    let bid: u128 = 5_000_000_000_000_000_000;
    let victim_commitment = commit(bid, 7, BIDDER);
    let attacker: Field = 0x000000000000000000000000000000000badc0de;
    main(victim_commitment, attacker, MIN, MAX, bid, 7);
}

#[test]
fn matches_the_frontend_cross_check_vector() {
    assert_eq(
        Poseidon2::hash([1, 2, 3], 3),
        0x23864adb160dddf590f1d3303683ebcb914f828e2635f6e85a32f0a1aecd3dd8,
    );
}
