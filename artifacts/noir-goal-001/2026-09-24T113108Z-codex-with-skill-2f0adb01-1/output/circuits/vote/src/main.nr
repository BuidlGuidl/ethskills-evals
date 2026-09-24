use poseidon::poseidon::bn254::hash_2;

global TREE_DEPTH: u32 = 8;
global DOMAIN_COMMITMENT: Field = 1;
global DOMAIN_NULLIFIER: Field = 2;

fn main(
    nullifier: Field,
    secret: Field,
    vote: bool,
    merkle_path: [Field; TREE_DEPTH],
    merkle_indices: [bool; TREE_DEPTH],
    path_exists: [bool; TREE_DEPTH],
    merkle_root: pub Field,
    proposal_id: pub Field,
    vote_choice: pub Field,
    nullifier_hash: pub Field,
) {
    let note_secret = hash_2([nullifier, secret]);
    let commitment = hash_2([DOMAIN_COMMITMENT, note_secret]);

    let computed_root = compute_lean_root(commitment, merkle_path, merkle_indices, path_exists);
    assert(computed_root == merkle_root, "Merkle proof invalid");

    let nullifier_domain = hash_2([DOMAIN_NULLIFIER, proposal_id]);
    let computed_nullifier_hash = hash_2([nullifier_domain, nullifier]);
    assert(computed_nullifier_hash == nullifier_hash, "Nullifier hash invalid");

    let vote_field = if vote { 1 } else { 0 };
    assert(vote_field == vote_choice, "Vote choice invalid");
}

fn compute_lean_root(
    leaf: Field,
    path: [Field; TREE_DEPTH],
    indices: [bool; TREE_DEPTH],
    exists: [bool; TREE_DEPTH],
) -> Field {
    let mut current = leaf;

    for i in 0..TREE_DEPTH {
        if exists[i] {
            let left = if !indices[i] { current } else { path[i] };
            let right = if !indices[i] { path[i] } else { current };
            current = hash_2([left, right]);
        } else {
            current = current;
        }
    }

    current
}
