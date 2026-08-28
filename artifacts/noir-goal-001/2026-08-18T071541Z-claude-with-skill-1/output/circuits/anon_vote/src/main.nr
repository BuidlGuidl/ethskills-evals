use binary_merkle_root::binary_merkle_root;
use poseidon::poseidon::bn254::hash_2;

/// Upper bound on the Merkle proof length. The registry tree is a LeanIMT, so its depth grows with
/// the membership: 150 members is depth 8, and this leaves room for 65,536. It is a compile-time
/// constant because circuits cannot loop over a dynamic bound, and it must equal `MAX_DEPTH` in
/// scripts/lib/tree.mjs, which pads witnesses to this length.
global MAX_DEPTH: u32 = 16;

/// Proves the three things a DAO needs to accept an anonymous ballot, and nothing more:
///
///   1. the prover knows the secrets behind *some* leaf of the member commitment tree,
///   2. `nullifier_hash` is the one and only nullifier those secrets produce for this proposal,
///   3. the ballot is 0 (no) or 1 (yes).
///
/// What stays private is what matters: the identity secrets, and the Merkle path — which is the
/// thing that would say *which* member this is. The verifier learns only the four public inputs.
///
/// `vote` is public and bound to the proof, so a relayer forwarding this ballot can drop it but
/// cannot flip it.
fn main(
    // Private: the member's two secrets, and the path proving their commitment is in the tree.
    identity_nullifier: Field,
    identity_secret: Field,
    depth: u32,
    indices: [bool; MAX_DEPTH],
    siblings: [Field; MAX_DEPTH],
    // Public. This order is repeated in AnonVoting.castVote and in NoirJS `proof.publicInputs`;
    // all three must agree.
    merkle_root: pub Field,
    proposal_id: pub Field,
    nullifier_hash: pub Field,
    vote: pub Field,
) {
    // Domain tag 1 marks this hash as a commitment, so a commitment can never be replayed as a
    // nullifier hash (tag 2) or vice versa.
    let commitment = hash_2([1, hash_2([identity_nullifier, identity_secret])]);

    // `depth` is a private input rather than a constant because LeanIMT collapses single-child
    // nodes, so a leaf's proof length depends on where it sits. Leaving it unconstrained is safe:
    // any wrong depth yields a different root, and `merkle_root` is pinned by the contract.
    let computed = binary_merkle_root(hash_2, commitment, depth, indices, siblings);
    assert(computed == merkle_root, "Invalid Merkle proof");

    // Scoping the nullifier to the proposal is what allows one identity to vote once on every
    // proposal, forever, while producing an unlinkable value each time.
    let domain = hash_2([2, proposal_id]);
    assert(hash_2([domain, identity_nullifier]) == nullifier_hash, "Nullifier mismatch");

    // Without this the contract's own `support <= 1` check could be bypassed by a proof carrying
    // an arbitrary field element, since the contract trusts the proof for the public inputs.
    assert(vote * (vote - 1) == 0, "Vote must be 0 or 1");
}

#[test]
fn test_poseidon_parity_with_js() {
    // The circuit, the offchain tree mirror and the onchain tree must hash identically or nothing
    // verifies. The same vector is pinned in scripts/hash-parity.mjs (poseidon-lite) and in
    // contracts/test/HashParity.t.sol (PoseidonT3).
    assert(
        hash_2([1, 2])
            == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a,
    );
}
