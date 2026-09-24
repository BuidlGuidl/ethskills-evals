use poseidon::poseidon::bn254::hash_2;

global MERKLE_DEPTH: u32 = 8;

fn hash_pair(left: Field, right: Field) -> Field {
    hash_2([left, right])
}

fn merkle_root(
    leaf: Field,
    path_elements: [Field; MERKLE_DEPTH],
    path_indices: [bool; MERKLE_DEPTH],
) -> Field {
    let mut current = leaf;

    for i in 0..MERKLE_DEPTH {
        let sibling = path_elements[i];
        current = if path_indices[i] {
            hash_pair(sibling, current)
        } else {
            hash_pair(current, sibling)
        };
    }

    current
}

fn main(
    nullifier: Field,
    secret: Field,
    path_elements: [Field; MERKLE_DEPTH],
    path_indices: [bool; MERKLE_DEPTH],
    root: pub Field,
    proposal_id: pub Field,
    vote: pub Field,
    nullifier_hash: pub Field,
) {
    assert((vote == 0) | (vote == 1));

    let leaf = hash_pair(nullifier, secret);
    let computed_root = merkle_root(leaf, path_elements, path_indices);
    assert(computed_root == root);

    let computed_nullifier_hash = hash_pair(nullifier, proposal_id);
    assert(computed_nullifier_hash == nullifier_hash);
}

#[test]
fn test_merkle_root_depth_one_position_zero() {
    let leaf = hash_pair(1, 2);
    let sibling = hash_pair(3, 4);
    let mut path_elements = [0; MERKLE_DEPTH];
    let path_indices = [false; MERKLE_DEPTH];

    path_elements[0] = sibling;
    let mut expected = hash_pair(leaf, sibling);
    for _ in 1..MERKLE_DEPTH {
        expected = hash_pair(expected, 0);
    }

    assert(merkle_root(leaf, path_elements, path_indices) == expected);
}

#[test]
fn test_poseidon_hash_2_matches_js_and_solidity_package() {
    assert(
        hash_pair(1, 2)
            == 7853200120776062878684798364095072458815029376092732009249414926327459813530,
    );
}

#[test]
fn test_main_accepts_valid_vote() {
    let nullifier = 11;
    let secret = 22;
    let proposal_id = 1;
    let vote = 1;
    let path_elements = [0; MERKLE_DEPTH];
    let path_indices = [false; MERKLE_DEPTH];

    let mut root = hash_pair(nullifier, secret);
    for _ in 0..MERKLE_DEPTH {
        root = hash_pair(root, 0);
    }

    main(
        nullifier,
        secret,
        path_elements,
        path_indices,
        root,
        proposal_id,
        vote,
        hash_pair(nullifier, proposal_id),
    );
}
