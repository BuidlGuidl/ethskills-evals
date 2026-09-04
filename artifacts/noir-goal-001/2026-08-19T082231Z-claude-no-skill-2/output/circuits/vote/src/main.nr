mod hash;
mod merkle;

/// Merkle tree depth. 2^10 = 1024 leaves, ample headroom over the 150 current
/// members. Must match TREE_DEPTH in `src/MemberRegistry.sol` and `js/core/tree.js`.
global TREE_DEPTH: u32 = 10;

/// Proves: "I am one of the members in the tree rooted at `root`, this is my
/// one and only nullifier for `vote_scope`, and I am casting `vote`."
///
/// What the proof deliberately does NOT reveal: which leaf, which commitment,
/// which member. The nullifier is a PRF of the member's secret under the
/// proposal scope, so it is unlinkable to the member's public commitment by
/// anyone who does not know the secret -- i.e. by anyone but the member.
///
/// Public inputs (this order is the order the verifier contract expects):
///   root        - Merkle root the proposal was pinned to at creation time.
///   vote_scope  - per-proposal domain separator, bound to the ballot contract.
///   nullifier   - spend-once tag; the contract rejects a repeat.
///   vote        - 1 for yes, 0 for no.
///   relayer     - the only address allowed to submit this proof onchain. This
///                 is what lets a member hand the proof to someone else (or to
///                 a burner wallet) without anyone being able to re-target it.
fn main(
    root: pub Field,
    vote_scope: pub Field,
    nullifier: pub Field,
    vote: pub Field,
    relayer: pub Field,
    secret: Field,
    path_bits: [bool; TREE_DEPTH],
    siblings: [Field; TREE_DEPTH],
) {
    // A ballot is yes or no, nothing else. Without this a prover could stuff the
    // tally with vote = 1000.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    // Keeps `relayer` a genuinely constrained public input (and rejects the zero
    // address). A proof is therefore only valid for the submitter it names.
    assert(relayer != 0, "relayer must be non-zero");

    // The leaf the DAO published for this member.
    let commitment = hash::hash1(secret);
    assert(
        merkle::compute_root(commitment, path_bits, siblings) == root,
        "commitment is not in the member tree",
    );

    // Deterministic per (member, proposal): one vote each, and no way to link it
    // back to `commitment` without `secret`.
    assert(hash::hash2(secret, vote_scope) == nullifier, "nullifier mismatch");
}

#[test]
fn accepts_a_valid_ballot() {
    let secret: Field = 424242;
    let commitment = hash::hash1(secret);
    let scope: Field = 7;

    // Build a depth-10 path where our leaf sits at index 0b0000000101 = 5.
    let path_bits: [bool; TREE_DEPTH] =
        [true, false, true, false, false, false, false, false, false, false];
    let siblings: [Field; TREE_DEPTH] = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111];
    let root = merkle::compute_root(commitment, path_bits, siblings);

    main(
        root,
        scope,
        hash::hash2(secret, scope),
        1,
        0xdeadbeef,
        secret,
        path_bits,
        siblings,
    );
}

#[test(should_fail_with = "nullifier mismatch")]
fn rejects_a_nullifier_from_another_proposal() {
    let secret: Field = 424242;
    let commitment = hash::hash1(secret);
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111];
    let root = merkle::compute_root(commitment, path_bits, siblings);
    // Nullifier computed for scope 8, submitted against scope 7.
    main(root, 7, hash::hash2(secret, 8), 0, 0xdeadbeef, secret, path_bits, siblings);
}

#[test(should_fail_with = "commitment is not in the member tree")]
fn rejects_a_non_member() {
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111];
    let root = merkle::compute_root(hash::hash1(424242), path_bits, siblings);
    let impostor: Field = 999999;
    main(
        root,
        7,
        hash::hash2(impostor, 7),
        1,
        0xdeadbeef,
        impostor,
        path_bits,
        siblings,
    );
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn rejects_a_weighted_vote() {
    let secret: Field = 424242;
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111];
    let root = merkle::compute_root(hash::hash1(secret), path_bits, siblings);
    main(root, 7, hash::hash2(secret, 7), 1000, 0xdeadbeef, secret, path_bits, siblings);
}
