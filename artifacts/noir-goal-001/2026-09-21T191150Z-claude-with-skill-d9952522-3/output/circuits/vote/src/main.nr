// Anonymous yes/no vote for one proposal.
//
// Proves, without revealing which member is voting:
//   1. the voter knows (nullifier, secret) for a commitment that is a leaf of the
//      member tree whose root was snapshotted when the proposal was created;
//   2. nullifier_hash = Poseidon(nullifier, scope), so the same member always
//      produces the same nullifier_hash for one proposal (double votes revert
//      onchain) but unrelated nullifier_hashes across proposals;
//   3. vote is 0 (no) or 1 (yes), and is bound to this proof.
//
// Hash compatibility (must match every layer):
//   - leaf       = poseidon3(nullifier, secret, LEAF_DOMAIN)   (JS: poseidon-lite poseidon3)
//   - tree node  = poseidon2(left, right)                      (Solidity: poseidon-solidity PoseidonT3,
//                                                                JS: poseidon-lite poseidon2)
//   All are the circomlib-compatible Poseidon over BN254 — NOT Poseidon2.
//
// The leaf uses a 3-input hash so no internal tree node (a 2-input hash) can ever be
// passed off as a leaf: the member tree is a LeanIMT with a variable-length path, and
// without that separation anyone could "open" an internal node (whose two children
// are public) as if it were a commitment and gain an extra vote.

use poseidon::poseidon::bn254::{hash_2, hash_3};

// 2^16 members of headroom; a 150-member DAO uses ~8 levels.
global MAX_DEPTH: u32 = 16;
global LEAF_DOMAIN: Field = 1;

// LeanIMT inclusion proof. Levels where the node had no sibling are skipped
// entirely (the node moves up unchanged), so the proof carries only `path_length`
// real siblings; `path_indices[i]` is true when the running node is the right child.
fn lean_imt_root(
    leaf: Field,
    path_length: u32,
    path_indices: [bool; MAX_DEPTH],
    siblings: [Field; MAX_DEPTH],
) -> Field {
    assert(path_length <= MAX_DEPTH);
    let mut node = leaf;
    for i in 0..MAX_DEPTH {
        // One hash per level: order the pair first, then hash once.
        let (left, right) = if path_indices[i] {
            (siblings[i], node)
        } else {
            (node, siblings[i])
        };
        let parent = hash_2([left, right]);
        if i < path_length {
            node = parent;
        }
    }
    node
}

fn main(
    // private: the member's note and their Merkle witness
    nullifier: Field,
    secret: Field,
    path_length: u32,
    path_indices: [bool; MAX_DEPTH],
    siblings: [Field; MAX_DEPTH],
    // public — order must match AnonymousVoting._publicInputs()
    root: pub Field,
    scope: pub Field,
    vote: pub Field,
    nullifier_hash: pub Field,
) {
    let commitment = hash_3([nullifier, secret, LEAF_DOMAIN]);
    assert(lean_imt_root(commitment, path_length, path_indices, siblings) == root);
    assert(hash_2([nullifier, scope]) == nullifier_hash);
    assert(vote * (vote - 1) == 0);
}

#[test]
fn test_single_leaf_tree() {
    // A one-leaf LeanIMT's root is the leaf itself.
    let nullifier = 11;
    let secret = 22;
    let leaf = hash_3([nullifier, secret, LEAF_DOMAIN]);
    let scope = 7;
    main(
        nullifier,
        secret,
        0,
        [false; MAX_DEPTH],
        [0; MAX_DEPTH],
        leaf,
        scope,
        1,
        hash_2([nullifier, scope]),
    );
}

#[test]
fn test_two_leaf_tree_right_child() {
    let other = 12345;
    let leaf = hash_3([3, 4, LEAF_DOMAIN]);
    let mut idx = [false; MAX_DEPTH];
    idx[0] = true;
    let mut sib = [0; MAX_DEPTH];
    sib[0] = other;
    main(3, 4, 1, idx, sib, hash_2([other, leaf]), 9, 0, hash_2([3, 9]));
}

#[test(should_fail)]
fn test_rejects_non_binary_vote() {
    let leaf = hash_3([1, 2, LEAF_DOMAIN]);
    main(1, 2, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], leaf, 5, 2, hash_2([1, 5]));
}

#[test]
fn print_reference_hashes() {
    // Cross-layer check vectors (compare with scripts/check-hashes.mjs and the forge test).
    std::println(hash_2([1, 2]));
    std::println(hash_3([1, 2, LEAF_DOMAIN]));
}
