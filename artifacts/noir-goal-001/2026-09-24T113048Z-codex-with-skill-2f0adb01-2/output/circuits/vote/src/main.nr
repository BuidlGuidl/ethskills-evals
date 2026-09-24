use poseidon::poseidon::bn254::hash_2;

global MAX_DEPTH: u32 = 8;

fn main(
    nullifier: Field,
    secret: Field,
    siblings: [Field; MAX_DEPTH],
    path_indices: [bool; MAX_DEPTH],
    path_length: u32,
    merkle_root: pub Field,
    proposal_id: pub Field,
    vote: pub Field,
    nullifier_hash: pub Field,
) {
    assert(path_length <= MAX_DEPTH, "Merkle path too long");
    assert(vote * (vote - 1) == 0, "Vote must be 0 or 1");

    let note_secret = hash_2([nullifier, secret]);
    let commitment = hash_2([1, note_secret]);

    let mut node = commitment;
    for i in 0..MAX_DEPTH {
        if i < path_length {
            let left = if path_indices[i] { siblings[i] } else { node };
            let right = if path_indices[i] { node } else { siblings[i] };
            node = hash_2([left, right]);
        }
    }

    assert(node == merkle_root, "Merkle proof invalid");

    let nullifier_domain = hash_2([2, proposal_id]);
    let expected_nullifier_hash = hash_2([nullifier_domain, nullifier]);
    assert(expected_nullifier_hash == nullifier_hash, "Nullifier hash mismatch");
}
