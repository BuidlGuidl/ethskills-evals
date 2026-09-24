use poseidon::poseidon::bn254::hash_2;

global TREE_DEPTH: u32 = 8;

fn main(
    nullifier: Field,
    secret: Field,
    path_elements: [Field; TREE_DEPTH],
    path_indices: [bool; TREE_DEPTH],
    root: pub Field,
    proposal_id: pub Field,
    nullifier_hash: pub Field,
    vote: pub Field,
) {
    assert(vote * (vote - 1) == 0);

    let commitment = hash_2([nullifier, secret]);
    let mut node = commitment;

    for i in 0..TREE_DEPTH {
        let sibling = path_elements[i];
        node = if path_indices[i] {
            hash_2([sibling, node])
        } else {
            hash_2([node, sibling])
        };
    }

    assert(node == root);
    assert(hash_2([nullifier, proposal_id]) == nullifier_hash);
}
