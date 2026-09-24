use poseidon::poseidon::bn254::{hash_1, hash_2};

// 2^16 leaves. Must match TREE_DEPTH in src/AnonVoting.sol and js/common/tree.mjs.
global TREE_DEPTH: u32 = 16;

// Proves, without revealing which member:
//   1. the prover knows `secret` whose commitment Poseidon(secret) is a leaf
//      of the member tree with root `merkle_root`;
//   2. `nullifier` = Poseidon(secret, scope), so one secret yields exactly one
//      nullifier per proposal (double-vote prevention) while nullifiers for
//      different proposals are unlinkable to each other and to the commitment;
//   3. `vote` is 0 (no) or 1 (yes). Binding it as a public input means a
//      relayer or mempool observer cannot change the vote without breaking
//      the proof.
fn main(
    // private
    secret: Field,
    path_siblings: [Field; TREE_DEPTH],
    path_indices: [bool; TREE_DEPTH],
    // public (order matters: it is the order of publicInputs on-chain)
    merkle_root: pub Field,
    scope: pub Field,
    vote: pub Field,
    nullifier: pub Field,
) {
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    // Refuse the trivial secret so a zero leaf can never be "owned".
    assert(secret != 0, "secret must be non-zero");

    let commitment = hash_1([secret]);
    assert(compute_root(commitment, path_siblings, path_indices) == merkle_root, "not a member");

    assert(hash_2([secret, scope]) == nullifier, "bad nullifier");
}

fn compute_root(
    leaf: Field,
    siblings: [Field; TREE_DEPTH],
    indices: [bool; TREE_DEPTH],
) -> Field {
    let mut node = leaf;
    for i in 0..TREE_DEPTH {
        // indices[i] == true means the current node is the right child.
        node = if indices[i] {
            hash_2([siblings[i], node])
        } else {
            hash_2([node, siblings[i]])
        };
    }
    node
}

#[test]
fn test_single_member_tree() {
    // Tree with one leaf at index 0; siblings are the zero-subtree hashes.
    let secret = 0x1234;
    let scope = 42;
    let mut siblings = [0; TREE_DEPTH];
    let mut z = 0;
    for i in 0..TREE_DEPTH {
        siblings[i] = z;
        z = hash_2([z, z]);
    }
    let indices = [false; TREE_DEPTH];
    let root = compute_root(hash_1([secret]), siblings, indices);
    main(secret, siblings, indices, root, scope, 1, hash_2([secret, scope]));
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn test_rejects_vote_2() {
    let secret = 0x1234;
    let siblings = [0; TREE_DEPTH];
    let indices = [false; TREE_DEPTH];
    let root = compute_root(hash_1([secret]), siblings, indices);
    main(secret, siblings, indices, root, 1, 2, hash_2([secret, 1]));
}

#[test(should_fail_with = "bad nullifier")]
fn test_rejects_wrong_scope_nullifier() {
    let secret = 0x1234;
    let siblings = [0; TREE_DEPTH];
    let indices = [false; TREE_DEPTH];
    let root = compute_root(hash_1([secret]), siblings, indices);
    main(secret, siblings, indices, root, 1, 1, hash_2([secret, 2]));
}
