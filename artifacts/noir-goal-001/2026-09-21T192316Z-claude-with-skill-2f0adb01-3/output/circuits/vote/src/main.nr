// Anonymous yes/no ballot for a DAO whose members registered an identity
// commitment in an onchain LeanIMT (Poseidon, BN254 — same hash as
// poseidon-solidity's PoseidonT3 and poseidon-lite's poseidon2).
//
// Proves, without revealing which member:
//   1. the prover knows (identity_nullifier, identity_trapdoor) whose commitment
//      is a leaf of the proposal's snapshot tree (`merkle_root`);
//   2. `nullifier_hash` is that member's unique nullifier for this proposal
//      (`scope`), so the contract can reject a second ballot — but nullifiers
//      for different proposals are unlinkable to each other;
//   3. `vote` is 0 or 1. The vote is a public input, so the proof is bound to
//      it: whoever relays the proof cannot flip or reuse it for the other side.
use poseidon::poseidon::bn254::hash_2;

// 2^16 leaves: ample headroom over the 150-member registry.
// Must be >= the LeanIMT depth onchain (ceil(log2(registered members))).
global MAX_DEPTH: u32 = 16;

// Domain tags keep commitments, nullifiers and scopes in separate hash domains.
global COMMITMENT_DOMAIN: Field = 1;
global NULLIFIER_DOMAIN: Field = 2;

fn main(
    // --- private: the member's secret identity (never leaves their machine)
    identity_nullifier: Field,
    identity_trapdoor: Field,
    // --- private: LeanIMT membership path (from @zk-kit/lean-imt generateProof)
    merkle_depth: u32,                   // = siblings.length for this leaf
    merkle_indices: [bool; MAX_DEPTH],   // bit i of proof.index (true = node is right child)
    merkle_siblings: [Field; MAX_DEPTH], // zero-padded past merkle_depth
    // --- public: order MUST match AnonymousVoting._publicInputs()
    merkle_root: pub Field,      // proposal's snapshot root
    scope: pub Field,            // per-proposal external nullifier (computed by the contract)
    vote: pub Field,             // 1 = yes, 0 = no
    nullifier_hash: pub Field,   // one-per-member-per-proposal tag
) {
    assert(merkle_depth <= MAX_DEPTH, "depth too large");
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    let commitment = identity_commitment(identity_nullifier, identity_trapdoor);
    let root = lean_imt_root(commitment, merkle_depth, merkle_indices, merkle_siblings);
    assert(root == merkle_root, "not a registered member at the proposal snapshot");

    assert(
        proposal_nullifier(identity_nullifier, scope) == nullifier_hash,
        "nullifier hash mismatch",
    );
}

fn identity_commitment(identity_nullifier: Field, identity_trapdoor: Field) -> Field {
    hash_2([COMMITMENT_DOMAIN, hash_2([identity_nullifier, identity_trapdoor])])
}

fn proposal_nullifier(identity_nullifier: Field, scope: Field) -> Field {
    hash_2([hash_2([NULLIFIER_DOMAIN, scope]), identity_nullifier])
}

// LeanIMT proofs omit levels where the node has no sibling (the node is carried
// up unchanged), so the path is `merkle_depth` hashes long and the index bits
// refer only to the included levels. Levels >= merkle_depth are ignored.
fn lean_imt_root(
    leaf: Field,
    depth: u32,
    indices: [bool; MAX_DEPTH],
    siblings: [Field; MAX_DEPTH],
) -> Field {
    let mut node = leaf;
    for i in 0..MAX_DEPTH {
        if i < depth {
            let (left, right) = if indices[i] {
                (siblings[i], node)
            } else {
                (node, siblings[i])
            };
            node = hash_2([left, right]);
        }
    }
    node
}

#[test]
fn test_single_level_tree() {
    let (n, t) = (11, 22);
    let leaf = identity_commitment(n, t);
    let other = identity_commitment(33, 44);
    let mut idx = [false; MAX_DEPTH];
    let mut sib = [0; MAX_DEPTH];
    idx[0] = true;
    sib[0] = other;
    let root = hash_2([other, leaf]);
    let scope = 7;
    main(n, t, 1, idx, sib, root, scope, 1, proposal_nullifier(n, scope));
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn test_rejects_non_binary_vote() {
    let leaf = identity_commitment(11, 22);
    main(11, 22, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], leaf, 7, 2, proposal_nullifier(11, 7));
}

#[test(should_fail_with = "nullifier hash mismatch")]
fn test_nullifier_bound_to_scope() {
    let leaf = identity_commitment(11, 22);
    main(11, 22, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], leaf, 8, 1, proposal_nullifier(11, 7));
}
