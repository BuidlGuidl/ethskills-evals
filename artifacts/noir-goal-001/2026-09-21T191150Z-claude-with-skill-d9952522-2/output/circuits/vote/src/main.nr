use poseidon::poseidon::bn254::hash_2;

// 2^10 = 1024 leaves: room for the 150 members plus turnover / key rotation.
global DEPTH: u32 = 10;

// Private: the member's note (nullifier, secret) and its Merkle path.
// Public:  the proposal's snapshot root, the per-proposal nullifier hash,
//          the proposal scope, and the vote itself (0 = no, 1 = yes).
fn main(
    nullifier: Field,
    secret: Field,
    path_siblings: [Field; DEPTH],
    path_indices: [bool; DEPTH],
    root: pub Field,
    nullifier_hash: pub Field,
    scope: pub Field,
    vote: pub Field,
) {
    // The leaf the member registered from their NFT wallet.
    let commitment = hash_2([nullifier, secret]);

    // Membership: the leaf is in the tree snapshotted when the proposal opened.
    let mut node = commitment;
    for i in 0..DEPTH {
        let sibling = path_siblings[i];
        node = if path_indices[i] {
            hash_2([sibling, node])
        } else {
            hash_2([node, sibling])
        };
    }
    assert(node == root);

    // One vote per member per proposal, and unlinkable across proposals:
    // the nullifier hash is scoped to this proposal.
    assert(nullifier_hash == hash_2([nullifier, scope]));

    // Binary vote. Being a public input, it is bound to the proof, so the
    // relayer that submits the proof cannot flip it.
    assert(vote * (vote - 1) == 0);
}

#[test]
fn test_hash_matches_js_and_solidity() {
    // poseidon-lite `poseidon2([1n, 2n])` and PoseidonT3.hash([1, 2]) give the
    // same value; contracts/test/Poseidon.t.sol pins the Solidity side.
    assert(hash_2([1, 2]) == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
}
