// Sealed-bid range proof.
//
// Proves: "the bid hidden inside `commitment` satisfies min_bid <= bid <= max_bid"
// without revealing `bid` or `salt`.
//
// ============================== COMMITMENT SCHEME ==============================
//
//   commitment = Poseidon2::hash([bid, salt, auction_id, bidder], 4)
//
// Frontend must compute it exactly like this:
//
//   bid        - bid amount in wei, integer 0 <= bid < 2^128, encoded as a field element.
//   salt       - 31 bytes from a CSPRNG (crypto.getRandomValues), read as a
//                big-endian integer. 31 bytes keeps it below the BN254 field modulus
//                so it is never reduced. It MUST be secret and fresh per bid: bids come
//                from a small, guessable space, so without a high-entropy salt anyone
//                could brute-force the bid from the commitment. Persist it (together
//                with bid) locally; it is needed later to generate the proof.
//   auction_id - the auction's id as stored by the contract (uint256, must be < the
//                BN254 scalar field modulus; a counter is fine).
//   bidder     - the bidder's Ethereum address as an integer, i.e. uint256(uint160(addr)).
//
//   Hash: Poseidon2 over BN254 (Barretenberg parameters, t = 4) in sponge mode with
//   the message length (4) encoded in the IV, as implemented by noir-lang/poseidon
//   `Poseidon2::hash(inputs, 4)`. In JS, `poseidon2Hash([bid, salt, auction_id, bidder])`
//   from @aztec/bb.js produces the same value. Inputs are in exactly this order.
//   The result is a field element; submit it onchain as bytes32 / uint256.
//
//   Cross-check your implementation against the `commitment_test_vector` test below
//   (`nargo test --show-output`) before shipping.
//
// Binding auction_id and bidder into the hash means a commitment (and its proof) can't
// be copied into another bidder's slot or replayed in another auction. The contract
// must pass the stored commitment, the auction's min/max, the auction id and the
// bidder's address (msg.sender / the slot owner) as the public inputs, in the order
// of the `main` parameters below.
//
// Why Poseidon2 + u128: Poseidon2 is a native Barretenberg gate (a couple hundred
// constraints for this hash vs. tens of thousands for keccak/sha256), and u128 range
// checks use lookup tables, so the circuit stays tiny for in-browser proving on phones.
// The contract never recomputes the hash - it only compares stored commitments - so
// the hash doesn't need to be EVM-friendly.
// ===============================================================================

use poseidon::poseidon2::Poseidon2;

fn main(
    // private
    bid: u128,
    salt: Field,
    // public
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    auction_id: pub Field,
    bidder: pub Field,
) {
    assert(commit(bid, salt, auction_id, bidder) == commitment, "commitment mismatch");
    assert(bid >= min_bid, "bid below minimum");
    assert(bid <= max_bid, "bid above maximum");
}

fn commit(bid: u128, salt: Field, auction_id: Field, bidder: Field) -> Field {
    Poseidon2::hash([bid as Field, salt, auction_id, bidder], 4)
}

// ----------------------------------- tests -----------------------------------

global SALT: Field = 0x0badc0ffee0badc0ffee0badc0ffee0badc0ffee0badc0ffee0badc0ffee00;
global AUCTION: Field = 7;
global BIDDER: Field = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

#[test]
fn commitment_test_vector() {
    // bid = 1.5 ETH
    let c = commit(1_500_000_000_000_000_000, SALT, AUCTION, BIDDER);
    std::println(c);
}

#[test]
fn accepts_bid_in_range() {
    let bid: u128 = 1_500_000_000_000_000_000;
    let c = commit(bid, SALT, AUCTION, BIDDER);
    main(bid, SALT, c, 1_000_000_000_000_000_000, 2_000_000_000_000_000_000, AUCTION, BIDDER);
}

#[test]
fn accepts_bounds_inclusive() {
    let c_min = commit(100, SALT, AUCTION, BIDDER);
    main(100, SALT, c_min, 100, 200, AUCTION, BIDDER);
    let c_max = commit(200, SALT, AUCTION, BIDDER);
    main(200, SALT, c_max, 100, 200, AUCTION, BIDDER);
}

#[test(should_fail_with = "bid below minimum")]
fn rejects_bid_below_min() {
    let c = commit(99, SALT, AUCTION, BIDDER);
    main(99, SALT, c, 100, 200, AUCTION, BIDDER);
}

#[test(should_fail_with = "bid above maximum")]
fn rejects_bid_above_max() {
    let c = commit(201, SALT, AUCTION, BIDDER);
    main(201, SALT, c, 100, 200, AUCTION, BIDDER);
}

#[test(should_fail_with = "commitment mismatch")]
fn rejects_wrong_opening() {
    // Commit to 500, then try to prove a different in-range bid.
    let c = commit(500, SALT, AUCTION, BIDDER);
    main(150, SALT, c, 100, 200, AUCTION, BIDDER);
}

#[test(should_fail_with = "commitment mismatch")]
fn rejects_commitment_reused_by_other_bidder() {
    let c = commit(150, SALT, AUCTION, BIDDER);
    main(150, SALT, c, 100, 200, AUCTION, 0x1234);
}
