use poseidon::poseidon2::Poseidon2;

// Sealed-bid auction: prove a committed bid lies in [min_bid, max_bid]
// without revealing the bid.
//
// ─────────────────────────────────────────────────────────────────────────────
// COMMITMENT SCHEME — the frontend MUST reproduce this exactly
// ─────────────────────────────────────────────────────────────────────────────
//
//   commitment = Poseidon2::hash([bid, blinding, auction_id, bidder], 4)
//
// All four inputs are BN254 field elements (the curve the onchain verifier
// uses), so every value must be < p =
//   21888242871839275222246405745257275088548364400416034343698204186575808495617
//
//   bid        wei, as an integer < 2^128 (~3.4e20 ETH — more than enough).
//   blinding   uniform random per bid. Sample 31 random bytes
//              (crypto.getRandomValues) and read them big-endian: that is
//              248 bits of entropy and is always < p, so no modular bias.
//              MUST be stored by the bidder — it is needed to prove, and it is
//              the only thing hiding the bid (bid amounts are low entropy and
//              would otherwise be brute-forced from the commitment).
//   auction_id the auction's id / listing id as a plain integer.
//   bidder     the bidder's address as an integer: BigInt(address) — 160 bits.
//              Binding the address stops a bidder from copying somebody else's
//              published commitment and later claiming that (unknown) bid.
//
// Frontend (@aztec/bb.js ships the exact same Poseidon2 sponge — same
// IV = len << 64 — so the digests match bit for bit):
//
//   import { poseidon2Hash } from "@aztec/bb.js";
//
//   const blinding = BigInt("0x" + Buffer.from(
//     crypto.getRandomValues(new Uint8Array(31))).toString("hex"));
//
//   const commitment = await poseidon2Hash([
//     bidWei,                 // bigint
//     blinding,               // bigint
//     BigInt(auctionId),      // bigint
//     BigInt(bidderAddress),  // bigint
//   ]);
//
// `commitment` (as bytes32) is what gets published onchain during the bidding
// window. After the window closes the bidder proves this circuit with the same
// four values; the contract feeds its own stored commitment / auction_id /
// bidder plus the auction's min_bid & max_bid as public inputs, so it never has
// to trust anything the prover says about them.
//
// Public input order (the order the Solidity verifier expects them in, one
// bytes32 each):
//   0: commitment, 1: min_bid, 2: max_bid, 3: auction_id, 4: bidder
//
// Build the onchain verifier with the keccak transcript:
//   nargo compile
//   bb write_vk --scheme ultra_honk --oracle_hash keccak -b target/sealed_bid_range.json -o target/vk
//   bb write_solidity_verifier --scheme ultra_honk -k target/vk/vk -o Verifier.sol
// and prove in the browser with the same --oracle_hash keccak.
//
// Cost note: Poseidon2 is the cheapest hash to prove on BN254, and this whole
// circuit is ~3k UltraHonk gates (measured with `bb gates`) — small enough that
// fixed proving overhead, not the constraints, sets the time on a mid-range
// phone. A keccak commitment would be ~50-100x the constraints and would buy
// nothing: the contract only stores the commitment, it never recomputes it.
fn main(
    // private
    bid: u128,
    blinding: Field,
    // public
    commitment: pub Field,
    min_bid: pub u128,
    max_bid: pub u128,
    auction_id: pub Field,
    bidder: pub Field,
) {
    // 1. the published commitment really opens to `bid` (with this blinding,
    //    for this auction, for this bidder).
    let recomputed = Poseidon2::hash([bid as Field, blinding, auction_id, bidder], 4);
    assert(recomputed == commitment, "commitment does not open to bid");

    // 2. min_bid <= bid <= max_bid.
    //    `bid` is a u128 so it is range-constrained to 128 bits by the ABI;
    //    these two comparisons are the only extra range checks needed.
    assert(bid >= min_bid, "bid below min_bid");
    assert(bid <= max_bid, "bid above max_bid");
}

mod tests {
    use super::main;
    use poseidon::poseidon2::Poseidon2;

    global AUCTION_ID: Field = 42;
    global BIDDER: Field = 0x00000000219ab540356cbb839cbe05303d7705fa;
    global BLINDING: Field = 0x1f2e3d4c5b6a798897a6b5c4d3e2f10012345678deadbeefcafebabe0badf00d;
    global MIN: u128 = 1000000000000000000; // 1 ETH
    global MAX: u128 = 100000000000000000000; // 100 ETH

    fn commit(bid: u128) -> Field {
        Poseidon2::hash([bid as Field, BLINDING, AUCTION_ID, BIDDER], 4)
    }

    #[test]
    fn accepts_bid_in_range() {
        let bid: u128 = 7500000000000000000; // 7.5 ETH
        main(bid, BLINDING, commit(bid), MIN, MAX, AUCTION_ID, BIDDER);
    }

    #[test]
    fn accepts_bounds() {
        main(MIN, BLINDING, commit(MIN), MIN, MAX, AUCTION_ID, BIDDER);
        main(MAX, BLINDING, commit(MAX), MIN, MAX, AUCTION_ID, BIDDER);
    }

    #[test(should_fail_with = "bid below min_bid")]
    fn rejects_bid_below_min() {
        let bid: u128 = 999999999999999999;
        main(bid, BLINDING, commit(bid), MIN, MAX, AUCTION_ID, BIDDER);
    }

    #[test(should_fail_with = "bid above max_bid")]
    fn rejects_bid_above_max() {
        let bid: u128 = 100000000000000000001;
        main(bid, BLINDING, commit(bid), MIN, MAX, AUCTION_ID, BIDDER);
    }

    // proving an in-range bid against somebody else's commitment must fail
    #[test(should_fail_with = "commitment does not open to bid")]
    fn rejects_wrong_opening() {
        let bid: u128 = 7500000000000000000;
        main(bid, BLINDING, commit(bid + 1), MIN, MAX, AUCTION_ID, BIDDER);
    }

    // a commitment made by another bidder cannot be reused
    #[test(should_fail_with = "commitment does not open to bid")]
    fn rejects_stolen_commitment() {
        let bid: u128 = 7500000000000000000;
        let theirs = Poseidon2::hash([bid as Field, BLINDING, AUCTION_ID, 0xdead], 4);
        main(bid, BLINDING, theirs, MIN, MAX, AUCTION_ID, BIDDER);
    }
}
