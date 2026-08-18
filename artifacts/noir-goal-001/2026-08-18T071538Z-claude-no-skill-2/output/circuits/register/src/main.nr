//! Registration circuit: "I appended `leaf` to the empty slot `index` of the
//! tree whose root is `old_root`, giving `new_root`."
//!
//! This is what lets the registry keep a correct Merkle root on chain without
//! any Poseidon2 in the EVM and without a trusted operator posting roots: the
//! contract pins `old_root` and `index` from its own storage, so the only
//! thing the caller gets to choose is the commitment itself.

use common::{compute_root, TREE_DEPTH};

fn main(
    old_root: pub Field,
    new_root: pub Field,
    leaf: pub Field,
    index: pub u32,
    siblings: [Field; TREE_DEPTH],
) {
    // A zero leaf would make the insertion a no-op and burn the slot.
    assert(leaf != 0, "commitment must be non-zero");

    // The slot must currently be empty (empty leaves are 0)...
    assert(compute_root(0, index, siblings) == old_root, "slot is not empty in old tree");

    // ...and filling exactly that slot must produce the claimed new root.
    assert(compute_root(leaf, index, siblings) == new_root, "new root does not follow");
}

#[test]
fn accepts_a_real_insertion() {
    let siblings = [0; TREE_DEPTH];
    let leaf = common::commitment(12345);
    let old_root = compute_root(0, 0, siblings);
    let new_root = compute_root(leaf, 0, siblings);
    main(old_root, new_root, leaf, 0, siblings);
}

#[test(should_fail_with = "new root does not follow")]
fn rejects_a_forged_new_root() {
    let siblings = [0; TREE_DEPTH];
    let leaf = common::commitment(12345);
    let old_root = compute_root(0, 0, siblings);
    main(old_root, 999, leaf, 0, siblings);
}
