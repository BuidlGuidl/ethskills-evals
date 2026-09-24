use std::hash::poseidon2_permutation;

global MERKLE_DEPTH: u32 = 8;

fn hash1(value: Field) -> Field {
    poseidon2_permutation([value, 0, 0, 101])[0]
}

fn hash2(left: Field, right: Field) -> Field {
    poseidon2_permutation([left, right, 0, 102])[0]
}

fn hash4(a: Field, b: Field, c: Field, d: Field) -> Field {
    let first = poseidon2_permutation([a, b, c, 104]);
    poseidon2_permutation([first[0], first[1], first[2], d])[0]
}

fn main(
    identity_secret: Field,
    merkle_path: [Field; MERKLE_DEPTH],
    path_indices: [bool; MERKLE_DEPTH],
    root: pub Field,
    proposal_id: pub Field,
    vote: pub Field,
    nullifier_hash: pub Field,
    vote_contract: pub Field,
    chain_id: pub Field,
) {
    assert((vote == 0) | (vote == 1));

    let leaf = hash1(identity_secret);
    let mut computed_root = leaf;

    for i in 0..MERKLE_DEPTH {
        if path_indices[i] {
            computed_root = hash2(merkle_path[i], computed_root);
        } else {
            computed_root = hash2(computed_root, merkle_path[i]);
        }
    }

    assert(computed_root == root);
    assert(nullifier_hash == hash4(identity_secret, proposal_id, vote_contract, chain_id));
}
