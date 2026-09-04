//! Fixed-depth Merkle inclusion proof over `hash::hash_pair`.
//!
//! Depth 8 => 256 leaves, enough for the 150 current members plus growth.
//! Layout matches the incremental tree in src/MembershipRegistry.sol.

use crate::hash::hash_pair;

pub global TREE_DEPTH: u32 = 8;

/// Walks `leaf` up to the root. Bit `i` of `leaf_index` says whether the node
/// sits on the right (1) or the left (0) of `siblings[i]` at that level.
pub fn compute_root(leaf: Field, leaf_index: u32, siblings: [Field; TREE_DEPTH]) -> Field {
    // Index must address a leaf of this tree, otherwise the bit decomposition
    // below would silently ignore the high bits.
    let leaf_count: u32 = 1 << TREE_DEPTH;
    assert(leaf_index < leaf_count, "leaf index out of range");

    let mut node = leaf;
    for i in 0..TREE_DEPTH {
        let on_the_right = (leaf_index >> i) & 1 == 1;
        let left = if on_the_right { siblings[i] } else { node };
        let right = if on_the_right { node } else { siblings[i] };
        node = hash_pair(left, right);
    }
    node
}

#[test]
fn root_of_a_two_leaf_tree() {
    let a = 11111;
    let b = 22222;
    let mut siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];

    // Level 0 sibling only; the rest of the tree is zeros in this toy check.
    siblings[0] = b;
    let root_from_a = compute_root(a, 0, siblings);

    siblings[0] = a;
    let root_from_b = compute_root(b, 1, siblings);

    assert(root_from_a == root_from_b);
}
