//! Sealed-bid auction — range proof over a committed bid.
//!
//! Proves: "the bid hidden inside `commitment` lies in [min_bid, max_bid]",
//! and nothing else. No Merkle tree, no nullifier, one circuit.
//! ~2,963 UltraHonk gates — small enough to prove in-browser on a mid phone.
//!
//! ===========================================================================
//! COMMITMENT SCHEME — what the frontend MUST compute
//! ===========================================================================
//!
//!     commitment = Poseidon2::hash([bid, blinding, auction_id, bidder], 4)
//!
//! Four BN254 field elements, in THIS order:
//!
//!   0. bid        — bid amount in wei, an integer < 2^128
//!   1. blinding   — a fresh uniformly random field element, one per bid
//!   2. auction_id — the auction id as the contract stores it
//!   3. bidder     — bidder address as a uint160 (the 20 address bytes read
//!                   big-endian into a field element)
//!
//! Poseidon2 over BN254, not Pedersen and not keccak: it is by far the cheapest
//! of the three inside the circuit, and in-circuit cost is what decides whether
//! proving finishes on a phone.
//!
//! In the browser (verified byte-identical to this circuit, see the test
//! vectors below):
//!
//!     // npm i @zkpassport/poseidon2   (v0.6.2 — Aztec-compatible Poseidon2)
//!     import { poseidon2Hash } from '@zkpassport/poseidon2';
//!
//!     const blinding = BigInt(
//!       '0x' + [...crypto.getRandomValues(new Uint8Array(31))]
//!                 .map(b => b.toString(16).padStart(2, '0')).join(''),
//!     );                                    // 248 bits, always < p
//!
//!     const commitment = poseidon2Hash([
//!       bidWei,                             // BigInt
//!       blinding,
//!       BigInt(auctionId),
//!       BigInt(bidderAddress),              // '0xabc...' -> BigInt
//!     ]);                                   // BigInt; hexlify to a bytes32
//!
//! During the bidding window the frontend posts ONLY that bytes32 to the
//! auction contract. `bid` and `blinding` never leave the device — persist them
//! (localStorage / keystore); they are needed again at proving time and the
//! commitment cannot be opened without them.
//!
//! `blinding` MUST come from a CSPRNG and MUST be full-width. Bids live in a
//! small, guessable space, so a short, derived, or reused blinding lets anyone
//! brute-force the preimage and read the sealed bid straight off the chain.
//!
//! `auction_id` and `bidder` sit in the preimage to domain-separate the
//! commitment. Without them, a proof for Alice's commitment is also a valid
//! proof for a *copy* of it: Mallory re-posts Alice's bytes32 under her own
//! address and replays Alice's proof verbatim, bidding an amount she doesn't
//! know. With them, the contract checks the public `bidder` against msg.sender
//! and the copy stops verifying.
//!
//! Test vectors (this circuit == @zkpassport/poseidon2, both checked):
//!   hash([1, 2, 3, 4])
//!     = 0x130bf204a32cac1f0ace56c78b731aa3809f06df2731ebcf6b3464a15788b1b9
//!   the Prover.toml example
//!     = 0x10487dff099b2b6a9735de7b71cc198aef78e3f6a4fe965a01f2c8b616a5463d
//!
//! ===========================================================================
//! PUBLIC INPUTS — order matters
//! ===========================================================================
//! The Solidity verifier is handed exactly this bytes32[], in this order:
//!
//!   [0] commitment  == the bytes32 registered for msg.sender in this auction
//!   [1] min_bid     == auction.minBid
//!   [2] max_bid     == auction.maxBid
//!   [3] auction_id  == the auction being settled
//!   [4] bidder      == uint160(msg.sender)
//!
//! The contract MUST rebuild all five from its own storage rather than take
//! them from calldata. A verifier that lets the caller choose min_bid/max_bid,
//! or that does not pin commitment and bidder to storage, proves nothing.
//!
//! ===========================================================================
//! BUILD (UltraHonk + keccak transcript = the EVM-verifiable flavour)
//! ===========================================================================
//!     nargo compile
//!     bb write_vk -b target/sealed_bid_range.json -o target -t evm
//!     bb write_solidity_verifier -k target/vk -o Verifier.sol
//!     # per bidder, in the browser:
//!     bb prove -b target/sealed_bid_range.json -w target/sealed_bid_range.gz \
//!              -o target -t evm

use poseidon::poseidon2::Poseidon2;

fn main(
    // --- private witness ---
    bid: u128,
    blinding: Field,
    // --- public inputs ---
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    auction_id: pub Field,
    bidder: pub Field,
) {
    // 1. The prover knows an opening of `commitment`. This is what ties the
    //    amount checked below to the bid locked in during the bidding window.
    let recomputed = Poseidon2::hash([bid as Field, blinding, auction_id, bidder], 4);
    assert(recomputed == commitment, "commitment does not open to (bid, blinding)");

    // 2. The opened bid is in range. bid/min_bid/max_bid are u128, so Noir
    //    range-constrains them to 128 bits at the ABI boundary and these are
    //    honest integer comparisons — no field wraparound to trick them, and no
    //    signed-underflow dance needed. 128 bits covers any real wei amount.
    assert(bid >= min_bid, "bid below auction minimum");
    assert(bid <= max_bid, "bid above auction maximum");
}

#[test]
fn accepts_bid_inside_range() {
    let bid: u128 = 3_500_000_000_000_000_000; // 3.5 ETH
    let blinding = 0x1f9a2c4e7b3d5081a6c3f2e9d47b10358ce6142f9b0d7a53286ef41cb90d7e25;
    let auction_id = 42;
    let bidder = 0x00a329c0648769a73afac7f9381e08fb43dbea72;

    let commitment = Poseidon2::hash([bid as Field, blinding, auction_id, bidder], 4);
    assert(commitment == 0x10487dff099b2b6a9735de7b71cc198aef78e3f6a4fe965a01f2c8b616a5463d);

    main(
        bid,
        blinding,
        commitment,
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
        auction_id,
        bidder,
    );
}

#[test]
fn accepts_bid_on_both_bounds() {
    for bid in [1_u128, 10_u128] {
        let commitment = Poseidon2::hash([bid as Field, 7, 42, 1], 4);
        main(bid, 7, commitment, 1, 10, 42, 1);
    }
}

#[test(should_fail_with = "bid below auction minimum")]
fn rejects_bid_below_min() {
    let bid: u128 = 999_999_999_999_999_999;
    let commitment = Poseidon2::hash([bid as Field, 7, 42, 1], 4);
    main(
        bid,
        7,
        commitment,
        1_000_000_000_000_000_000,
        10_000_000_000_000_000_000,
        42,
        1,
    );
}

#[test(should_fail_with = "bid above auction maximum")]
fn rejects_bid_above_max() {
    let bid: u128 = 11;
    let commitment = Poseidon2::hash([bid as Field, 7, 42, 1], 4);
    main(bid, 7, commitment, 1, 10, 42, 1);
}

#[test(should_fail_with = "commitment does not open to (bid, blinding)")]
fn rejects_wrong_opening() {
    // In-range bid, but not the one that was committed to.
    let commitment = Poseidon2::hash([5, 7, 42, 1], 4);
    main(6, 7, commitment, 1, 10, 42, 1);
}

#[test(should_fail_with = "commitment does not open to (bid, blinding)")]
fn rejects_replay_under_another_address() {
    // Alice commits; Mallory re-posts the same bytes32 and replays the proof.
    let alice = 0x00a329c0648769a73afac7f9381e08fb43dbea72;
    let mallory = 0x00b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d;
    let commitment = Poseidon2::hash([5, 7, 42, alice], 4);
    main(5, 7, commitment, 1, 10, 42, mallory);
}
