use poseidon::poseidon::bn254::hash_4;

// Sealed-bid auction: range proof over a previously published bid commitment.
//
// Flow:
//   1. Bidding window  — bidder publishes `commitment` onchain (nothing else).
//   2. Window closes   — bidder proves, without revealing `bid`, that the amount
//                        behind `commitment` lies in [min_bid, max_bid].
//   3. Contract        — checks the proof's public inputs equal (the commitment it
//                        stored for msg.sender, its own auction id, msg.sender,
//                        and the auction's configured bounds).
//
// ---------------------------------------------------------------------------
// COMMITMENT SCHEME — the frontend MUST compute it exactly like this
// ---------------------------------------------------------------------------
//
//   commitment = poseidon_bn254_hash_4([ bid, salt, auction_id, bidder ])
//
// Field-by-field, all as BN254 field elements (decimal/bigint, not hex strings):
//
//   bid        u128, the bid amount in WEI. Must be < 2^128 (the circuit takes it
//              as `u128`, so a larger value simply cannot be witnessed).
//   salt       uniformly random blinding factor in [0, p). Generate 31 random
//              bytes and read them big-endian — that is always < p, no rejection
//              sampling needed. WITHOUT this, `bid` is brute-forceable: bids live
//              in a tiny domain and Poseidon is cheap to evaluate.
//   auction_id u64 auction identifier assigned by the auction contract. Binds the
//              commitment to one auction so it cannot be replayed into another.
//   bidder     the bidder's Ethereum address as a 160-bit integer
//              (`BigInt(address)`). Binds the commitment to one wallet so a
//              competitor cannot copy someone else's commitment as their own.
//
// The bidder must persist `bid` and `salt` locally — without them no proof can
// ever be produced and the deposit is stuck.
//
// Reference frontend code (circomlibjs implements the same BN254 Poseidon as
// noir-lang/poseidon):
//
//   import { buildPoseidon } from "circomlibjs";
//   const poseidon = await buildPoseidon();
//   const salt = BigInt("0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex"));
//   const c = poseidon.F.toObject(poseidon([bidWei, salt, BigInt(auctionId), BigInt(bidder)]));
//   const commitmentHex = "0x" + c.toString(16).padStart(64, "0");
//
// Verify that parity ONCE with a known vector before shipping — the `commitment_vector`
// test below prints the circuit's own output for a fixed input; the JS above must
// produce the identical value.
//
// ---------------------------------------------------------------------------
// PUBLIC INPUT ORDER (circuit `pub` params == proof.publicInputs == Solidity)
// ---------------------------------------------------------------------------
//   [0] commitment  [1] min_bid  [2] max_bid  [3] auction_id  [4] bidder
//
fn main(
    // --- private ---
    bid: u128,
    salt: Field,
    // --- public ---
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    auction_id: pub u64,
    bidder: pub Field,
) {
    // 1. The prover really knows the opening of the published commitment.
    //    `bid as Field` is the canonical injection of a u128 into the field, so
    //    the frontend just hashes the plain integer.
    let recomputed = hash_4([bid as Field, salt, auction_id as Field, bidder]);
    assert(recomputed == commitment, "commitment does not open to (bid, salt)");

    // 2. The hidden bid is inside the auction's allowed range.
    //    u128 comparisons are range-decompositions, ~a few hundred gates total —
    //    the Poseidon call above dominates the circuit, so this stays cheap
    //    enough to prove in a mobile browser.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

#[test]
fn accepts_bid_in_range() {
    let bid: u128 = 3_500_000_000_000_000_000; // 3.5 ETH in wei
    let salt = 0x0badc0ffee1234567890abcdef00112233445566778899aabbccddeeff001122;
    let auction_id: u64 = 42;
    let bidder = 0x00a0Ee7A142d267C1f36714E4a8F75612F20a79c;
    let commitment = hash_4([bid as Field, salt, auction_id as Field, bidder]);

    main(bid, salt, commitment, 1_000_000_000_000_000_000, 10_000_000_000_000_000_000, auction_id, bidder);
}

#[test(should_fail_with = "bid above max_bid")]
fn rejects_bid_above_range() {
    let bid: u128 = 11_000_000_000_000_000_000;
    let salt = 7;
    let auction_id: u64 = 42;
    let bidder = 0x00a0Ee7A142d267C1f36714E4a8F75612F20a79c;
    let commitment = hash_4([bid as Field, salt, auction_id as Field, bidder]);

    main(bid, salt, commitment, 1_000_000_000_000_000_000, 10_000_000_000_000_000_000, auction_id, bidder);
}

#[test(should_fail_with = "commitment does not open to")]
fn rejects_wrong_opening() {
    main(1, 2, 3, 0, 10, 42, 0x00a0Ee7A142d267C1f36714E4a8F75612F20a79c);
}

// Cross-layer parity vector. `nargo test --show-output commitment_vector` prints:
//   poseidon([1, 2, 3, 4]) =
//   0x299c867db6c1fdd79dcefa40e4510b9837e60ebb1ce0663dbaa525df65250465
// The frontend Poseidon must print the same value before you ship anything.
#[test]
fn commitment_vector() {
    // bid = 1 wei, salt = 2, auction_id = 3, bidder = 4
    println(hash_4([1, 2, 3, 4]));
}

