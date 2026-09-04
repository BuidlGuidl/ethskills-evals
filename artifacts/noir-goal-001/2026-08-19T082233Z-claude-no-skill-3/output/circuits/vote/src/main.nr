//! One private ballot.
//!
//! Proves, without revealing which member is speaking:
//!   1. "I know the secret behind one of the leaves of the membership tree
//!      that was snapshotted when this proposal was created."
//!   2. "This nullifier is the one and only nullifier that secret can produce
//!      for this proposal, on this chain, in this contract."  -> one member,
//!      one vote, and nothing links the nullifier back to the leaf.
//!   3. "The yes/no I am publishing is the one I am proving for, and it may
//!      only be relayed by this submitter."
//!
//! Everything in the `pub` block is what the chain sees. Note that `secret`
//! never appears there, and neither does the leaf nor its position.

mod hash;
mod merkle;

use hash::hash_pair;
use merkle::{compute_root, TREE_DEPTH};

/// Domain tag for the membership leaf. A proposal scope is a hash and is
/// checked to be non-zero, so a leaf can never collide with a nullifier of the
/// same secret.
global LEAF_TAG: Field = 0;

fn main(
    // ---- public inputs: exactly what the vote transaction carries ----
    membership_root: pub Field,
    proposal_scope: pub Field,
    nullifier: pub Field,
    support: pub Field,
    submitter: pub Field,
    // ---- private inputs: never leave the voter's machine ----
    secret: Field,
    leaf_index: u32,
    siblings: [Field; TREE_DEPTH],
) {
    // A ballot is yes or no, nothing else - keeps a member from stuffing the
    // tally with support = 1000.
    assert(support * (support - 1) == 0, "support must be 0 or 1");

    // proposal_scope = hash(hash(ballot contract, chain id), proposal id), so
    // a ballot proved for one proposal cannot be replayed onto another
    // proposal, another deployment of this contract, or another chain.
    assert(proposal_scope != LEAF_TAG, "proposal scope must not be 0");

    // Bind the submitter into the proof, so a proof handed to a relayer (or
    // spotted in the mempool) cannot be re-pointed at a different sender.
    // The byte decomposition is a real constraint, which is what keeps this
    // public input from being optimised out of the circuit.
    let submitter_bytes: [u8; 32] = submitter.to_be_bytes();
    for i in 0..12 {
        assert(submitter_bytes[i] == 0, "submitter must be a 20-byte address");
    }

    // 1. membership: our leaf is in the snapshotted tree.
    let commitment = hash_pair(secret, LEAF_TAG);
    let root = compute_root(commitment, leaf_index, siblings);
    assert(root == membership_root, "not a member of the snapshot");

    // 2. one vote per member per proposal, with no link back to the leaf.
    assert(nullifier == hash_pair(secret, proposal_scope), "wrong nullifier");
}

#[test]
fn accepts_a_valid_ballot() {
    let secret = 0x1234567890abcdef;
    let commitment = hash_pair(secret, LEAF_TAG);

    // Two-leaf tree, our member sits at index 1, everything above is zeros.
    let mut siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    siblings[0] = 42;
    let mut node = hash_pair(siblings[0], commitment);
    for i in 1..TREE_DEPTH {
        node = hash_pair(node, siblings[i]);
    }

    let proposal_scope = 7;
    main(
        node,
        proposal_scope,
        hash_pair(secret, proposal_scope),
        1,
        0x00000000000000000000000000000000000000ff,
        secret,
        1,
        siblings,
    );
}

#[test(should_fail_with = "wrong nullifier")]
fn rejects_a_nullifier_from_another_proposal() {
    let secret = 0x1234567890abcdef;
    let commitment = hash_pair(secret, LEAF_TAG);
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let mut node = commitment;
    for i in 0..TREE_DEPTH {
        node = hash_pair(node, siblings[i]);
    }

    // Nullifier computed for scope 8 while voting in scope 7: that is the
    // "reuse an old proof somewhere else" attempt.
    main(node, 7, hash_pair(secret, 8), 0, 1, secret, 0, siblings);
}

#[test(should_fail_with = "support must be 0 or 1")]
fn rejects_a_non_binary_ballot() {
    let secret = 5;
    let commitment = hash_pair(secret, LEAF_TAG);
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let mut node = commitment;
    for i in 0..TREE_DEPTH {
        node = hash_pair(node, siblings[i]);
    }
    main(node, 7, hash_pair(secret, 7), 1000, 1, secret, 0, siblings);
}
