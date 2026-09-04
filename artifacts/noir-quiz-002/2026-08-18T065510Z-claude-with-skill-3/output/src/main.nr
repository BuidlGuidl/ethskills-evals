use poseidon::poseidon::bn254::hash_5;

// Domain tag for bid commitments. Any other hash this protocol ever computes
// must use a different tag, so a commitment can never be replayed as some
// other kind of preimage.
global BID_COMMITMENT_DOMAIN: Field = 1;

// ---------------------------------------------------------------------------
// COMMITMENT SCHEME — what the frontend must compute
// ---------------------------------------------------------------------------
//
//   commitment = Poseidon([1, auction_id, bidder, bid, salt])
//
// That is the *classic* BN254 Poseidon (noir-lang/poseidon `bn254::hash_5`),
// 5 inputs, in exactly this order. It is NOT Poseidon2 and NOT keccak.
//
// In JS use circomlibjs, which is byte-for-byte compatible with this circuit
// (verified: poseidon([1,2]) == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a
// in both circomlibjs and bn254::hash_2):
//
//   import { buildPoseidon } from "circomlibjs";
//   const poseidon = await buildPoseidon();
//   const F = poseidon.F;
//
//   const salt = BigInt("0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex"));
//   const commitment = F.toObject(poseidon([
//     1n,                        // BID_COMMITMENT_DOMAIN, literal 1
//     BigInt(auctionId),         // uint256 auction id, same value the contract stores
//     BigInt(bidderAddress),     // 20-byte address as a number, e.g. BigInt("0xabc...")
//     bidWei,                    // bid in wei, must fit in u128
//     salt,                      // fresh 248-bit randomness, see below
//   ]));
//   // -> send `0x${commitment.toString(16).padStart(64, "0")}` onchain during the bidding window,
//   //    and persist { auctionId, bidder, bidWei, salt } locally — without salt the bid is unprovable.
//
// Rules the frontend MUST follow:
//  * salt is fresh, uniformly random, and >= 128 bits. Bids have almost no
//    entropy (round ETH amounts), so a small or reused salt makes the
//    commitment brute-forceable and the whole scheme pointless. Never reuse a
//    salt across bids.
//  * all five inputs are BN254 field elements (< ~2^254). Pass numbers/bigints,
//    not hex strings with different padding — Poseidon hashes values, but the
//    proof inputs must be the identical values.
//  * bid is in wei and must be < 2^128; the circuit rejects anything larger.
//  * bidder is the address that will send the reveal-proof transaction. The
//    contract compares this public input against msg.sender, which is what
//    stops someone copying your commitment out of the mempool and claiming it,
//    and stops proofs being replayed for another auction (auction_id) or by
//    another account.
//
// Public inputs are emitted in declaration order — the Solidity verifier call
// must pass them as [commitment, min_bid, max_bid, auction_id, bidder].
// ---------------------------------------------------------------------------

fn main(
    // Private: never leaves the browser.
    bid: u128,
    salt: Field,
    // Public.
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    auction_id: pub Field,
    bidder: pub Field,
) {
    // 1. The prover knows an opening of the published commitment.
    let computed =
        hash_5([BID_COMMITMENT_DOMAIN, auction_id, bidder, bid as Field, salt]);
    assert(computed == commitment, "commitment does not open to (bid, salt)");

    // 2. That opening lies in the auction's allowed range, inclusive.
    //    `bid` is u128, so these comparisons are range checks over 128 bits —
    //    no field wraparound, and no separate bit-decomposition needed.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

#[test]
fn test_in_range() {
    // commitment for auction 42, bidder 0xdeadbeef, bid 1.5 ETH, salt below
    main(
        1500000000000000000,
        0x0a1b2c3d4e5f60718293a4b5c6d7e8f9,
        0x0d36b38e7e3d7b3ae0f9225a2318030bdeb39716fb875cfd6a7eb5e60c49f45b,
        1000000000000000000,
        10000000000000000000,
        42,
        0xdeadbeef,
    );
}

#[test(should_fail_with = "bid below min_bid")]
fn test_below_min() {
    let bid: u128 = 1;
    let salt = 0x0a1b2c3d4e5f60718293a4b5c6d7e8f9;
    let commitment = hash_5([BID_COMMITMENT_DOMAIN, 42, 0xdeadbeef, bid as Field, salt]);
    main(bid, salt, commitment, 1000000000000000000, 10000000000000000000, 42, 0xdeadbeef);
}

#[test(should_fail_with = "commitment does not open to (bid, salt)")]
fn test_wrong_opening() {
    // Same commitment as test_in_range, but claiming a different bid.
    main(
        2000000000000000000,
        0x0a1b2c3d4e5f60718293a4b5c6d7e8f9,
        0x0d36b38e7e3d7b3ae0f9225a2318030bdeb39716fb875cfd6a7eb5e60c49f45b,
        1000000000000000000,
        10000000000000000000,
        42,
        0xdeadbeef,
    );
}
