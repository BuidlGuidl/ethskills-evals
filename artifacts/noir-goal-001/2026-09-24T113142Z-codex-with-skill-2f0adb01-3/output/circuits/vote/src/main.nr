use poseidon::poseidon::bn254::hash_2;

global TREE_DEPTH: u32 = 8;

fn main(
    nullifier: Field,
    secret: Field,
    vote: bool,
    merkle_path: [Field; TREE_DEPTH],
    merkle_indices: [bool; TREE_DEPTH],
    merkle_root: pub Field,
    proposal_id: pub Field,
    nullifier_hash: pub Field,
    vote_choice: pub Field,
) {
    let note_secret = hash_2([nullifier, secret]);
    let commitment = hash_2([1, note_secret]);

    let computed_root = compute_merkle_root(commitment, merkle_path, merkle_indices);
    assert(computed_root == merkle_root, "Invalid membership root");

    let nullifier_domain = hash_2([2, proposal_id]);
    let computed_nullifier_hash = hash_2([nullifier_domain, nullifier]);
    assert(computed_nullifier_hash == nullifier_hash, "Invalid nullifier hash");

    let vote_as_field = if vote { 1 } else { 0 };
    assert(vote_choice == vote_as_field, "Vote must match public choice");
}

fn compute_merkle_root(
    leaf: Field,
    path: [Field; TREE_DEPTH],
    indices: [bool; TREE_DEPTH],
) -> Field {
    let mut current = leaf;
    for i in 0..TREE_DEPTH {
        let (left, right) = if !indices[i] {
            (current, path[i])
        } else {
            (path[i], current)
        };
        current = hash_2([left, right]);
    }
    current
}
