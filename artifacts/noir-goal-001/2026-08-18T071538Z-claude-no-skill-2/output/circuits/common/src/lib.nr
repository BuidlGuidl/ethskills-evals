//! Shared primitives for the anonymous-ballot circuits.
//!
//! One fixed-depth incremental Merkle tree holds every member's identity
//! commitment. Registration proves an insertion into it; voting proves
//! membership in a snapshot of it without revealing which leaf.

use poseidon::poseidon2::Poseidon2;

/// 2^8 = 256 leaves, enough for the 150-member DAO with room to grow.
pub global TREE_DEPTH: u32 = 8;
pub global TREE_CAPACITY: u32 = 256;

/// The leaf a member publishes when they join the vote.
/// Hiding + binding: the secret is a uniformly random field element, so the
/// commitment tells an observer nothing beyond "some member joined".
pub fn commitment(secret: Field) -> Field {
    Poseidon2::hash([secret], 1)
}

/// Per-proposal double-vote tag. Deterministic in (secret, proposal), so the
/// same member cannot vote twice on one proposal, and unlinkable across
/// proposals because Poseidon2 outputs for different second inputs are
/// uncorrelated.
pub fn nullifier(secret: Field, proposal_context: Field) -> Field {
    Poseidon2::hash([secret, proposal_context], 2)
}

pub fn hash_pair(left: Field, right: Field) -> Field {
    Poseidon2::hash([left, right], 2)
}

/// Walk `leaf` up to the root along `siblings`, using the bits of `index` to
/// decide left/right at each level. Branch-free so the constraint system does
/// not depend on the (secret) index.
pub fn compute_root(leaf: Field, index: u32, siblings: [Field; TREE_DEPTH]) -> Field {
    assert(index < TREE_CAPACITY, "leaf index out of range");
    let bits: [bool; TREE_DEPTH] = (index as Field).to_le_bits();

    let mut node = leaf;
    for i in 0..TREE_DEPTH {
        let sibling = siblings[i];
        let b = bits[i] as Field; // 0 => node is the left child, 1 => right
        let left = node + b * (sibling - node);
        let right = sibling + b * (node - sibling);
        node = hash_pair(left, right);
    }
    node
}

#[test]
fn root_of_single_leaf_is_stable() {
    let siblings = [0; TREE_DEPTH];
    let a = compute_root(commitment(1), 0, siblings);
    let b = compute_root(commitment(1), 0, siblings);
    assert(a == b);
    assert(a != compute_root(commitment(2), 0, siblings));
}

#[test]
fn index_selects_a_different_path() {
    let siblings = [7; TREE_DEPTH];
    assert(compute_root(3, 0, siblings) != compute_root(3, 1, siblings));
}

#[test]
fn nullifier_is_unlinkable_across_proposals() {
    assert(nullifier(42, 1) != nullifier(42, 2));
}

/// The root of a tree with no members yet: fold the empty subtree up the
/// levels. Mirrored as `EMPTY_ROOT` in MemberRegistry.sol, which cannot
/// compute Poseidon2 for itself.
pub fn empty_root() -> Field {
    let mut node = 0;
    for _ in 0..TREE_DEPTH {
        node = hash_pair(node, node);
    }
    node
}

#[test]
fn empty_root_matches_the_solidity_constant() {
    assert(empty_root() == 0x067243231eddf4222f3911defbba7705aff06ed45960b27f6f91319196ef97e1);

    // An empty tree really is what a member proves their slot against.
    let mut siblings = [0; TREE_DEPTH];
    let mut zero = 0;
    for i in 0..TREE_DEPTH {
        siblings[i] = zero;
        zero = hash_pair(zero, zero);
    }
    assert(compute_root(0, 0, siblings) == empty_root());
}
