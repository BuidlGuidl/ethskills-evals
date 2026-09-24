use poseidon::poseidon::bn254::hash_2;

fn main(
    secret: Field,
    nullifier: Field,
    path_elements: [Field; 8],
    path_indices: [bool; 8],
    root: pub Field,
    nullifier_hash: pub Field,
    proposal_id: pub Field,
    vote: pub Field,
) {
    assert(vote * (vote - 1) == 0);

    let commitment = hash_2([secret, nullifier]);
    let mut computed_root = commitment;

    for i in 0..8 {
        if path_indices[i] {
            computed_root = hash_2([path_elements[i], computed_root]);
        } else {
            computed_root = hash_2([computed_root, path_elements[i]]);
        }
    }

    assert(computed_root == root);
    assert(nullifier_hash == hash_2([nullifier, proposal_id]));
}
