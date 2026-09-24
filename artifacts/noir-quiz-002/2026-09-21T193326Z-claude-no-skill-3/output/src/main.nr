use poseidon::poseidon2::Poseidon2;

// Sealed-bid range proof.
//
// Proves: "I know (bid, salt) such that
//            commitment == Poseidon2(bid, salt, bidder, auction_id)
//          and min_bid <= bid <= max_bid"
// without revealing bid or salt.
//
// ---------------------------------------------------------------------------
// COMMITMENT SCHEME — the frontend MUST compute it exactly like this:
//
//   commitment = Poseidon2::hash([bid, salt, bidder, auction_id], 4)
//
//   Poseidon2 over the BN254 scalar field, sponge with t = 4, rate = 3,
//   IV = message_length << 64 (here 4 << 64). This is the same function as
//   Barretenberg's `poseidon2Hash` in @aztec/bb.js. Pin the bb.js version to
//   the one that matches the `bb` used to build the verifier, e.g.:
//
//     import { Barretenberg, Fr } from "@aztec/bb.js";
//     const api = await Barretenberg.new();
//     const commitment = await api.poseidon2Hash([
//       new Fr(bidWei),                // bid, in wei, must be < 2^128
//       salt,                          // Fr, see below
//       new Fr(BigInt(bidderAddress)), // 20-byte address as a field element
//       new Fr(auctionId),             // uint256 auction id, must be < p
//     ]);
//
//   Field encodings (each is a single BN254 field element):
//     bid        — the bid amount in wei, as an integer. Must be < 2^128
//                  (the circuit rejects anything larger).
//     salt       — 32 bytes from crypto.getRandomValues, reduced mod p
//                  (or 31 random bytes, which are always < p). It MUST be
//                  secret and fresh per bid; the bid is low-entropy, so without
//                  a strong salt anyone can brute-force the commitment. Store
//                  it locally (it is needed to prove later) — lose it and the
//                  bid cannot be proven.
//     bidder     — the bidder's Ethereum address (msg.sender that will submit
//                  the proof), interpreted as a big-endian uint160.
//     auction_id — the auction's uint256 id. Must be < p (use a counter).
//
//   Onchain, store `commitment` as bytes32 / uint256 in the bidding phase.
//
//   Known-answer vector (check your frontend against this; also asserted in
//   test_commitment_vector below):
//     Poseidon2::hash([150, 42, 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B, 1], 4)
//       = 0x10dd851601fe8c4a580458c354ef085717f36b6edd6f10e954e87d871133a9ee
//
// Why bidder and auction_id are hashed in: they bind the commitment (and
// hence the proof) to one bidder in one auction. Without them, an attacker
// could copy Alice's commitment during bidding, then replay Alice's proof as
// their own after the window closes, or reuse a proof across auctions.
// ---------------------------------------------------------------------------
//
// PUBLIC INPUTS (order = order of `pub` params below; the Solidity verifier
// expects them as bytes32[] in exactly this order):
//   [0] commitment   — the contract MUST load this from its own storage for
//                      (auction_id, msg.sender); never take it from calldata.
//   [1] bidder       — the contract MUST pass uint256(uint160(msg.sender)).
//   [2] auction_id   — the contract MUST pass the auction being settled.
//   [3] min_bid      — the contract MUST pass the auction's stored min_bid.
//   [4] max_bid      — the contract MUST pass the auction's stored max_bid.
// If the contract lets the caller choose any of these, the proof proves
// nothing about the stored bid.
//
// Cost: Poseidon2 (4 inputs at rate 3 = 2 permutations, each a native
// Barretenberg gadget) plus two 128-bit comparisons. Poseidon2 is used instead
// of Pedersen/Keccak/SHA256 because it is by far the cheapest hash to prove.
fn main(
    bid: u128,
    salt: Field,
    commitment: pub Field,
    bidder: pub Field,
    auction_id: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // `bid` is typed u128, so Noir range-checks it to [0, 2^128). This is what
    // makes the comparisons below sound — a raw Field has no ordering and a
    // "negative" (p - x) value would otherwise wrap around.
    let computed = Poseidon2::hash([bid as Field, salt, bidder, auction_id], 4);
    assert(computed == commitment, "commitment mismatch");

    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

#[test]
fn test_bid_in_range() {
    let bid: u128 = 1_500_000_000_000_000_000; // 1.5 ETH
    let salt = 0x1234567890abcdef;
    let bidder = 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B;
    let auction_id = 7;
    let commitment = Poseidon2::hash([bid as Field, salt, bidder, auction_id], 4);
    main(
        bid,
        salt,
        commitment,
        bidder,
        auction_id,
        1_000_000_000_000_000_000,
        2_000_000_000_000_000_000,
    );
}

#[test]
fn test_bid_at_bounds() {
    let salt = 42;
    let bidder = 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B;
    let lo: u128 = 100;
    let hi: u128 = 200;
    main(
        lo,
        salt,
        Poseidon2::hash([lo as Field, salt, bidder, 1], 4),
        bidder,
        1,
        lo,
        hi,
    );
    main(
        hi,
        salt,
        Poseidon2::hash([hi as Field, salt, bidder, 1], 4),
        bidder,
        1,
        lo,
        hi,
    );
}

#[test(should_fail_with = "bid below min_bid")]
fn test_bid_below_min() {
    let bid: u128 = 99;
    let bidder = 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B;
    let commitment = Poseidon2::hash([bid as Field, 42, bidder, 1], 4);
    main(bid, 42, commitment, bidder, 1, 100, 200);
}

#[test(should_fail_with = "bid above max_bid")]
fn test_bid_above_max() {
    let bid: u128 = 201;
    let bidder = 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B;
    let commitment = Poseidon2::hash([bid as Field, 42, bidder, 1], 4);
    main(bid, 42, commitment, bidder, 1, 100, 200);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_wrong_salt() {
    let bid: u128 = 150;
    let bidder = 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B;
    let commitment = Poseidon2::hash([bid as Field, 42, bidder, 1], 4);
    main(bid, 43, commitment, bidder, 1, 100, 200);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_proof_bound_to_bidder() {
    // An attacker who copied Alice's commitment cannot prove it as themselves.
    let bid: u128 = 150;
    let alice = 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B;
    let mallory = 0x1111111111111111111111111111111111111111;
    let commitment = Poseidon2::hash([bid as Field, 42, alice, 1], 4);
    main(bid, 42, commitment, mallory, 1, 100, 200);
}

#[test]
fn test_commitment_vector() {
    let c = Poseidon2::hash([150, 42, 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B, 1], 4);
    assert(c == 0x10dd851601fe8c4a580458c354ef085717f36b6edd6f10e954e87d871133a9ee);
}
