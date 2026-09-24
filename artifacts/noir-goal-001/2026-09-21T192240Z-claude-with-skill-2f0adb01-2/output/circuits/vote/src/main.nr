// Anonymous yes/no vote for a DAO member.
//
// Proves: "I know the secrets behind one of the commitments in the member
// tree whose root was snapshotted for this proposal, this is the one-and-only
// nullifier those secrets give for this proposal, and my vote is 0 or 1" —
// without revealing which commitment (i.e. which member).
//
// Hash: circomlib-compatible Poseidon over BN254 (poseidon::bn254::hash_2).
// The onchain LeanIMT (PoseidonT3) and the JS mirror (poseidon-lite poseidon2)
// use the same function, so roots agree across all three layers.
use poseidon::poseidon::bn254::hash_2;

// Max tree depth. 2^16 = 65,536 members is far above the 150 we need; the
// actual LeanIMT depth is passed in as `depth`.
global MAX_DEPTH: u32 = 16;

// Domain tags so a commitment can never be confused with a nullifier hash.
global DOMAIN_COMMITMENT: Field = 1;
global DOMAIN_NULLIFIER: Field = 2;

fn main(
    // ---- private: the member's note, never leaves their machine ----
    identity_nullifier: Field,
    identity_trapdoor: Field,
    // ---- private: LeanIMT membership path (from the JS mirror) ----
    depth: u32,
    indices: [bool; MAX_DEPTH],
    siblings: [Field; MAX_DEPTH],
    // ---- public: order MUST match VoteBox._publicInputs() ----
    merkle_root: pub Field, // proposal's snapshotted member root
    scope: pub Field, // keccak(chainid, voteBox, proposalId) mod p
    nullifier_hash: pub Field, // one per (member, proposal)
    vote: pub Field, // 0 = no, 1 = yes
) {
    // The vote is bound into the proof, so a relayer cannot flip it.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    let commitment = commitment(identity_nullifier, identity_trapdoor);

    let computed_root = lean_imt_root(commitment, depth, indices, siblings);
    assert(computed_root == merkle_root, "not a registered member");

    assert(
        nullifier_hash == nullifier_hash_for(identity_nullifier, scope),
        "nullifier hash mismatch",
    );
}

fn commitment(identity_nullifier: Field, identity_trapdoor: Field) -> Field {
    hash_2([DOMAIN_COMMITMENT, hash_2([identity_nullifier, identity_trapdoor])])
}

fn nullifier_hash_for(identity_nullifier: Field, scope: Field) -> Field {
    hash_2([hash_2([DOMAIN_NULLIFIER, scope]), identity_nullifier])
}

// LeanIMT root: a node with no right sibling is carried up unhashed, and the
// path returned by @zk-kit/lean-imt's generateProof only contains levels that
// had a sibling. So we hash for the first `depth` levels and ignore the rest.
fn lean_imt_root(
    leaf: Field,
    depth: u32,
    indices: [bool; MAX_DEPTH],
    siblings: [Field; MAX_DEPTH],
) -> Field {
    assert(depth <= MAX_DEPTH, "depth too large");
    let mut node = leaf;
    for i in 0..MAX_DEPTH {
        if i < depth {
            node = if !indices[i] {
                hash_2([node, siblings[i]])
            } else {
                hash_2([siblings[i], node])
            };
        }
    }
    node
}

// ---------------------------------------------------------------- tests ----

#[test]
fn test_single_member_tree() {
    // A 1-leaf LeanIMT's root is the leaf itself (depth 0).
    let n = 111;
    let t = 222;
    let c = commitment(n, t);
    let root = lean_imt_root(c, 0, [false; MAX_DEPTH], [0; MAX_DEPTH]);
    assert(root == c);
    main(n, t, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], root, 42, nullifier_hash_for(n, 42), 1);
}

#[test]
fn test_three_member_tree() {
    // Leaves [a, b, c]: root = H(H(a, b), c). Prove membership of b (index 1).
    let a = commitment(1, 2);
    let b = commitment(3, 4);
    let c = commitment(5, 6);
    let root = hash_2([hash_2([a, b]), c]);
    let mut indices = [false; MAX_DEPTH];
    let mut siblings = [0; MAX_DEPTH];
    indices[0] = true;
    siblings[0] = a;
    indices[1] = false;
    siblings[1] = c;
    main(3, 4, 2, indices, siblings, root, 7, nullifier_hash_for(3, 7), 0);
}

#[test]
fn test_nullifier_is_scoped_per_proposal() {
    assert(nullifier_hash_for(3, 7) != nullifier_hash_for(3, 8));
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn test_rejects_vote_2() {
    let c = commitment(1, 2);
    main(1, 2, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], c, 9, nullifier_hash_for(1, 9), 2);
}

#[test(should_fail_with = "not a registered member")]
fn test_rejects_non_member() {
    let c = commitment(1, 2);
    main(9, 9, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], c, 9, nullifier_hash_for(9, 9), 1);
}

#[test(should_fail_with = "nullifier hash mismatch")]
fn test_rejects_foreign_nullifier() {
    let c = commitment(1, 2);
    main(1, 2, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], c, 9, nullifier_hash_for(1, 10), 1);
}

#[test]
fn test_hash_parity_vector() {
    // Known circomlib Poseidon vector: poseidon([1, 2]). The JS mirror and
    // PoseidonT3 must produce the same value (checked in scripts/ and forge tests).
    assert(hash_2([1, 2]) == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
}
