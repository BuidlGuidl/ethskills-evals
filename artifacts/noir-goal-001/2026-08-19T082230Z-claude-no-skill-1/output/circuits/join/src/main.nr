//! `join` — authenticate one append to the membership tree.
//!
//! The registry contract holds only a root and a leaf count; it never hashes.
//! Instead every append comes with a proof that `new_root` is exactly
//! `old_root` with the single slot at `leaf_index` changed from empty to
//! `commitment`. That makes the root trustless: nobody, including the DAO,
//! can move the tree to a root of their choosing (e.g. one padded with extra
//! leaves they hold secrets for).
//!
//! Nothing here is secret. The member's wallet, their commitment and their
//! leaf index are all public — membership is public by assumption. The only
//! private witness is the sibling path, which is derivable from the public
//! event log anyway; it is private simply because it does not need to be sent.

use dao_zk::{EMPTY_LEAF, merkle_root_from_path, TREE_DEPTH};

fn main(
    old_root: pub Field,
    new_root: pub Field,
    commitment: pub Field,
    leaf_index: pub Field,
    siblings: [Field; TREE_DEPTH],
) {
    // An empty commitment would make an occupied slot indistinguishable from a
    // free one, which would let the slot be overwritten later.
    assert(commitment != EMPTY_LEAF, "commitment must be non-empty");

    // The slot really is free in the tree the contract currently holds.
    assert_eq(
        merkle_root_from_path(EMPTY_LEAF, leaf_index, siblings),
        old_root,
        "leaf_index is not empty under old_root",
    );

    // Re-using the same siblings pins every other leaf: the new root differs
    // from the old one in this slot and nowhere else.
    assert_eq(
        merkle_root_from_path(commitment, leaf_index, siblings),
        new_root,
        "new_root is not old_root with commitment inserted",
    );
}

mod tests {
    use dao_zk::{EMPTY_LEAF, hash_node, merkle_root_from_path, TREE_DEPTH};

    /// Sibling path for an untouched slot in an otherwise empty tree.
    fn empty_siblings() -> [Field; TREE_DEPTH] {
        let mut zeros: [Field; TREE_DEPTH] = [EMPTY_LEAF; TREE_DEPTH];
        for level in 1..TREE_DEPTH {
            zeros[level] = hash_node(zeros[level - 1], zeros[level - 1]);
        }
        zeros
    }

    #[test]
    fn accepts_an_honest_first_append() {
        let siblings = empty_siblings();
        let commitment = 0x1234;
        let old_root = merkle_root_from_path(EMPTY_LEAF, 0, siblings);
        let new_root = merkle_root_from_path(commitment, 0, siblings);
        super::main(old_root, new_root, commitment, 0, siblings);
    }

    #[test(should_fail_with = "new_root is not old_root with commitment inserted")]
    fn rejects_a_new_root_that_changes_other_leaves() {
        let siblings = empty_siblings();
        let commitment = 0x1234;
        let old_root = merkle_root_from_path(EMPTY_LEAF, 0, siblings);
        super::main(old_root, 0xbadf00d, commitment, 0, siblings);
    }

    #[test(should_fail_with = "leaf_index is not empty under old_root")]
    fn rejects_overwriting_an_occupied_slot() {
        let siblings = empty_siblings();
        let occupied = 0x1111;
        // Pretend the slot already holds `occupied`, then try to append over it.
        let old_root = merkle_root_from_path(occupied, 0, siblings);
        let new_root = merkle_root_from_path(0x2222, 0, siblings);
        super::main(old_root, new_root, 0x2222, 0, siblings);
    }

    #[test(should_fail_with = "commitment must be non-empty")]
    fn rejects_an_empty_commitment() {
        let siblings = empty_siblings();
        let old_root = merkle_root_from_path(EMPTY_LEAF, 0, siblings);
        super::main(old_root, old_root, EMPTY_LEAF, 0, siblings);
    }
}
