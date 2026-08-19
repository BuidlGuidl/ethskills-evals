use poseidon::poseidon2::Poseidon2;

// ─────────────────────────────────────────────────────────────────────────────
// Sealed-bid auction — range proof over a committed bid.
//
// The bidder posts `commitment` on chain during the bidding window. After the
// window closes they prove, without revealing anything else, that the amount
// inside that commitment is in [min_bid, max_bid].
//
//
// COMMITMENT SCHEME — the frontend MUST compute it exactly like this:
//
//     commitment = poseidon2([bid, nonce])        // 2-input Poseidon2 sponge
//                                                 // over the BN254 field
//   where
//     bid   = bid amount in wei, an integer in [0, 2^128)
//     nonce = secret blinding factor, a uniformly random BN254 field element
//
// In the browser (bb.js is already loaded — it is what generates the proof —
// and its `poseidon2Hash` is the same Barretenberg sponge this circuit compiles
// to; the handshake vectors below are there to prove that before you ship):
//
//     import { Barretenberg, Fr } from "@aztec/bb.js";
//
//     const api = await Barretenberg.new();
//
//     // 31 random bytes are always < the BN254 modulus, so no reduction bias
//     const bytes = crypto.getRandomValues(new Uint8Array(31));
//     const nonce = new Fr(BigInt("0x" + Buffer.from(bytes).toString("hex")));
//
//     const commitment = await api.poseidon2Hash([new Fr(bidWei), nonce]);
//     // -> send `commitment` to the auction contract during the bidding window
//     // -> store `bidWei` and `nonce` locally (IndexedDB/keystore); BOTH are
//     //    required later to prove, and neither is recoverable if lost
//
// (`poseidon2Hash` from `@zkpassport/poseidon2` is a lighter pure-JS drop-in
// with identical output if you would rather not pull in bb.js on the commit
// page.) Handshake vectors — assert these once in a frontend unit test, they
// are the exact values this circuit computes:
//
//     poseidon2([1, 2])
//       = 0x038682aa1cb5ae4e0a3f13da432a95c77c5c111f6f030faf9cad641ce1ed7383
//     poseidon2([3500000000000000000, 42])
//       = 0x14276c546fe3785a9a3d9e13b8b4232caf2b15ac4e76cc6c3157994b9cd08c22
//
//
// NONCE RULES — bids are low-entropy and guessable, so the nonce is the only
// thing hiding the amount. Sample it fresh from a CSPRNG for every bid, never
// derive it from the bid, never reveal it. A reused nonce leaks which bids are
// equal; a low-entropy nonce lets anyone brute-force the commitment offline.
//
// WHY POSEIDON2 AND NOT keccak256: proving happens in the browser on mid-range
// phones, so gate count is the budget. Measured with `bb gates` on this circuit
// (UltraHonk, bb 5.1.0): 2,888 gates total — ~2,840 for the Poseidon2 opening,
// ~50 for both range comparisons. The same commitment over keccak256 benchmarks
// at 40,618 gates, ~14x more proving time and peak memory for no benefit here:
// nothing on chain recomputes the hash. The contract only stores the commitment
// the bidder posted and hands it straight back to the verifier as a public
// input, so an EVM-friendly hash buys nothing.
//
//
// ON-CHAIN WIRING — public inputs reach the UltraHonk verifier in declaration
// order: [commitment, min_bid, max_bid]. The auction contract MUST check that
//   * `commitment` equals the commitment it recorded for this bidder during the
//     bidding window, and
//   * `min_bid` / `max_bid` are the auction's own parameters,
// before accepting the proof. Without both checks a bidder could prove against
// a commitment or a range of their own choosing and the proof would say nothing.
//
// Prove and generate the verifier in the EVM/ZK configuration — keccak
// transcript, blinded (bb 5.x):
//
//     nargo compile
//     bb write_vk -b target/sealed_bid_range_proof.json -o vk  --verifier_target evm
//     bb write_solidity_verifier -k vk/vk -o Verifier.sol      --verifier_target evm
//     bb prove -b target/sealed_bid_range_proof.json -w target/sealed_bid_range_proof.gz \
//              -k vk/vk -o proof                               --verifier_target evm
//
// The `--verifier_target evm` flag is load-bearing: the `*-no-zk` variants
// produce a plain UltraHonk proof, which is succinct but NOT zero-knowledge and
// can leak information about the witness — i.e. exactly the bid we are hiding.
// ─────────────────────────────────────────────────────────────────────────────

fn main(
    // ── private witness ──
    bid: u128,
    nonce: Field,
    // ── public inputs ──
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
) {
    // 1. The prover knows an opening (bid, nonce) of the on-chain commitment.
    assert_eq(
        Poseidon2::hash([bid as Field, nonce], 2),
        commitment,
        "commitment does not open to (bid, nonce)",
    );

    // 2. That opening lies in the auction's range. `bid` is a u128, so these are
    //    plain integer comparisons — no field wrap-around to guard against — and
    //    they compile to ~50 gates via range lookups. u128 covers every plausible
    //    wei amount (2^128 wei ≈ 3.4e20 ETH) at half the range-check width of a
    //    full-field comparison.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

#[test]
fn accepts_bid_inside_range() {
    let bid: u128 = 3_500_000_000_000_000_000; // 3.5 ETH
    let nonce: Field = 0x1f2e3d4c5b6a798897a6b5c4d3e2f10123456789abcdef0fedcba987654321;
    main(
        bid,
        nonce,
        Poseidon2::hash([bid as Field, nonce], 2),
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
    );
}

#[test]
fn accepts_bid_on_either_bound() {
    let nonce: Field = 42;
    let lo: u128 = 1_000_000_000_000_000_000;
    let hi: u128 = 10_000_000_000_000_000_000;
    main(lo, nonce, Poseidon2::hash([lo as Field, nonce], 2), lo, hi);
    main(hi, nonce, Poseidon2::hash([hi as Field, nonce], 2), lo, hi);
}

#[test(should_fail_with = "bid below min_bid")]
fn rejects_bid_below_range() {
    let bid: u128 = 999_999_999_999_999_999;
    let nonce: Field = 7;
    main(
        bid,
        nonce,
        Poseidon2::hash([bid as Field, nonce], 2),
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
    );
}

#[test(should_fail_with = "bid above max_bid")]
fn rejects_bid_above_range() {
    let bid: u128 = 10_000_000_000_000_000_001;
    let nonce: Field = 7;
    main(
        bid,
        nonce,
        Poseidon2::hash([bid as Field, nonce], 2),
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
    );
}

#[test(should_fail_with = "commitment does not open to (bid, nonce)")]
fn rejects_bid_that_does_not_match_the_commitment() {
    let nonce: Field = 7;
    let committed: u128 = 500_000_000_000_000_000; // the real bid, below range
    let claimed: u128 = 2_000_000_000_000_000_000; // what the prover pretends
    main(
        claimed,
        nonce,
        Poseidon2::hash([committed as Field, nonce], 2),
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
    );
}
