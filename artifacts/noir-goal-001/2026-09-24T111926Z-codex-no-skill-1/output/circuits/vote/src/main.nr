global TREE_DEPTH: u32 = 8;
global LEAF_DOMAIN: Field = 1;
global NULLIFIER_DOMAIN: Field = 2;
global HASH_DOMAIN: Field = 3;

fn pow5(x: Field) -> Field {
    let x2 = x * x;
    let x4 = x2 * x2;
    x4 * x
}

fn round_constant(i: u32) -> Field {
    let n = i as Field;
    (n * n) + 7
}

fn hash2(left: Field, right: Field) -> Field {
    let key = right + HASH_DOMAIN;
    let mut state = left + HASH_DOMAIN;

    for i in 0..91 {
        state = pow5(state + key + round_constant(i));
    }

    state + key
}

fn main(
    secret: Field,
    path: [Field; TREE_DEPTH],
    path_indices: [bool; TREE_DEPTH],
    proposal_id: pub Field,
    merkle_root: pub Field,
    nullifier: pub Field,
    vote: pub Field,
) {
    assert((vote == 0) | (vote == 1), "vote must be 0 or 1");

    let leaf = hash2(LEAF_DOMAIN, secret);
    let mut node = leaf;

    for i in 0..8 {
        if !path_indices[i] {
            node = hash2(node, path[i]);
        } else {
            node = hash2(path[i], node);
        }
    }

    assert(node == merkle_root, "invalid membership path");

    let proposal_scope = hash2(NULLIFIER_DOMAIN, proposal_id);
    let computed_nullifier = hash2(proposal_scope, secret);
    assert(computed_nullifier == nullifier, "invalid nullifier");
}
