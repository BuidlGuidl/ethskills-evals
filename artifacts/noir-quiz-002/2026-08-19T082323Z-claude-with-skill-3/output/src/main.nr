use poseidon::poseidon2::Poseidon2;

// Sealed-bid auction: prove the committed bid sits in [min_bid, max_bid]
// without revealing it.
//
// ── COMMITMENT SCHEME ─────────────────────────────────────────────────────
//
//   commitment = Poseidon2([bid, blinding])
//
//   bid      : bid amount in wei, < 2^128
//   blinding : a uniformly random BN254 field element
//
// The blinding factor is NOT optional. A bid lives in a tiny domain (round
// numbers of ETH), so Poseidon2([bid]) alone is brute-forceable in seconds by
// anyone reading the commitment off the chain — the auction would be sealed in
// name only. `blinding` must be freshly sampled per bid and never reused.
//
// Poseidon2 because it costs ~600 gates against ~30,000 for keccak256/SHA256:
// the whole circuit is 2,888 gates, which is what makes it provable on a
// mid-range phone. Never hash with keccak inside the circuit.
//
// ── HOW THE FRONTEND COMPUTES IT ──────────────────────────────────────────
//
// This is barretenberg's Poseidon2 over BN254, which `@aztec/bb.js` — the same
// package that generates the proof — exports as `poseidon2Hash`. Browser and
// circuit therefore agree by construction. Do NOT substitute Poseidon v1
// (`poseidon::poseidon::bn254::hash_2`, or circomlibjs `poseidon`): different
// function, different output, proof will not verify.
//
//   import { Barretenberg, Fr } from "@aztec/bb.js";
//
//   const bb         = await Barretenberg.new();
//   const blinding   = Fr.random();               // 32 random bytes, mod r
//   const bid        = new Fr(BigInt(bidWei));    // wei, must be < 2^128
//   const commitment = await bb.poseidon2Hash([bid, blinding]);
//
//   // 1. during the bidding window: publish commitment.toString() onchain
//   // 2. persist { bidWei, blinding: blinding.toString() } client-side —
//   //    lose the blinding factor and the bid can never be proven or opened
//
// The input order [bid, blinding] is part of the commitment: swapping the two
// yields a different hash. Test one commitment across JS and circuit (`nargo
// execute`) before wiring up the frontend.
//
// ── PROVING AND VERIFYING ─────────────────────────────────────────────────
//
// After the window closes the bidder proves in the browser with NoirJS, in
// process — never by shelling out to the `bb` CLI:
//
//   const noir    = new Noir(circuit);
//   const backend = new UltraHonkBackend(circuit.bytecode, await Barretenberg.new());
//   const { witness } = await noir.execute({
//     bid: bidWei, blinding, commitment, min_bid, max_bid,
//   });
//   const { proof, publicInputs } =
//     await backend.generateProof(witness, { keccak: true });   // EVM serialization
//
// `{ keccak: true }` is required — the default serialization does not verify
// onchain. Generate the Solidity verifier's VK the same way
// (`bb write_vk --oracle_hash keccak`, then `bb write_solidity_verifier`) and
// keep prove / verify / VK on that one setting.
//
// Public inputs are [commitment, min_bid, max_bid], in that order, matching
// the `pub` parameters below; read the generated verifier's ABI rather than
// assuming its signature. The auction contract must pin `commitment` to the
// one this bidder published for *this* auction and supply its own min/max —
// the circuit proves a relation, it cannot know which auction it is verified
// against — and must only accept the bid after `verify()` returns true.
//
fn main(
    // private
    bid: u128,
    blinding: Field,
    // public
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // 1. The bid opens the published commitment.
    assert(Poseidon2::hash([bid as Field, blinding], 2) == commitment, "bad commitment");

    // 2. The bid is inside the auction's allowed range (inclusive).
    //    u128 comparison range-checks 128 bits, which covers any wei amount;
    //    the two asserts are the bulk of the circuit and still leave it small
    //    enough to prove in a browser.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

#[test]
fn test_bid_in_range() {
    let bid: u128 = 5_000_000_000_000_000_000; // 5 ETH
    let blinding = 0x1cf4c3b2a19e8d7f6051a2b3c4d5e6f70819243546576879a0b1c2d3e4f50617;
    let commitment = Poseidon2::hash([bid as Field, blinding], 2);
    main(bid, blinding, commitment, 1_000_000_000_000_000_000, 10_000_000_000_000_000_000);
}

#[test(should_fail_with = "bid above max_bid")]
fn test_bid_above_range() {
    let bid: u128 = 20_000_000_000_000_000_000;
    let blinding = 42;
    let commitment = Poseidon2::hash([bid as Field, blinding], 2);
    main(bid, blinding, commitment, 1_000_000_000_000_000_000, 10_000_000_000_000_000_000);
}

#[test(should_fail_with = "bid below min_bid")]
fn test_bid_below_range() {
    let bid: u128 = 1;
    let blinding = 42;
    let commitment = Poseidon2::hash([bid as Field, blinding], 2);
    main(bid, blinding, commitment, 1_000_000_000_000_000_000, 10_000_000_000_000_000_000);
}

#[test(should_fail_with = "bad commitment")]
fn test_wrong_opening() {
    let bid: u128 = 5_000_000_000_000_000_000;
    let commitment = Poseidon2::hash([bid as Field, 42], 2);
    // proving a different bid against the same commitment must fail
    main(6_000_000_000_000_000_000, 42, commitment, 1_000_000_000_000_000_000, 10_000_000_000_000_000_000);
}
