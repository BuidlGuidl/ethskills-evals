// Anonymous yes/no vote for a DAO member.
//
// Proves, without revealing which member:
//   1. the prover knows (nullifier, secret) for a commitment that is a leaf of the
//      member tree whose root was snapshotted when the proposal was created;
//   2. nullifier_hash is the unique, per-proposal tag for that member, so the
//      contract can reject a second vote on the same proposal while votes on
//      different proposals remain unlinkable to each other;
//   3. the vote is 0 (no) or 1 (yes) and is bound to this proof, so whoever relays
//      the transaction cannot flip it.
//
// Merkle path bits: merkle_indices[i] = true when our node is the right child.
//
// Hashing is circom-compatible Poseidon (t=3) everywhere: here, in the onchain
// LeanIMT (poseidon-solidity PoseidonT3) and in the offchain mirror (poseidon-lite).
use poseidon::poseidon::bn254::hash_2;

// 2^16 = 65,536 members. The DAO has 150 today; the tree depth grows with
// membership, the circuit only fixes the maximum.
global MAX_DEPTH: u32 = 16;

// Hash domains: keep commitments and nullifier tags from ever colliding.
global COMMITMENT_DOMAIN: Field = 1;
global NULLIFIER_DOMAIN: Field = 2;

pub fn note_commitment(nullifier: Field, secret: Field) -> Field {
    hash_2([COMMITMENT_DOMAIN, hash_2([nullifier, secret])])
}

pub fn nullifier_tag(nullifier: Field, external_nullifier: Field) -> Field {
    hash_2([hash_2([NULLIFIER_DOMAIN, external_nullifier]), nullifier])
}

// LeanIMT-compatible root: levels where a node has no sibling are skipped by the
// offchain proof generator, so only the first `depth` entries are hashed.
pub fn lean_imt_root(
    leaf: Field,
    depth: u32,
    indices: [bool; MAX_DEPTH],
    siblings: [Field; MAX_DEPTH],
) -> Field {
    assert(depth <= MAX_DEPTH, "depth too large");
    let mut node = leaf;
    for i in 0..MAX_DEPTH {
        if i < depth {
            let (left, right) = if !indices[i] {
                (node, siblings[i])
            } else {
                (siblings[i], node)
            };
            node = hash_2([left, right]);
        }
    }
    node
}

fn main(
    // private
    nullifier: Field,
    secret: Field,
    merkle_depth: u32,
    merkle_indices: [bool; MAX_DEPTH],
    merkle_siblings: [Field; MAX_DEPTH],
    // public — order MUST match AnonVoting._publicInputs()
    merkle_root: pub Field,
    external_nullifier: pub Field,
    nullifier_hash: pub Field,
    vote: pub Field,
) {
    let commitment = note_commitment(nullifier, secret);
    let root = lean_imt_root(commitment, merkle_depth, merkle_indices, merkle_siblings);
    assert(root == merkle_root, "not a member of the snapshotted tree");

    assert(nullifier_tag(nullifier, external_nullifier) == nullifier_hash, "bad nullifier hash");

    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");
}

#[test]
fn test_single_member_tree() {
    // A one-leaf LeanIMT has depth 0 and root == leaf.
    let nullifier = 11;
    let secret = 22;
    let commitment = note_commitment(nullifier, secret);
    let ext = 12345;
    main(
        nullifier,
        secret,
        0,
        [false; MAX_DEPTH],
        [0; MAX_DEPTH],
        commitment,
        ext,
        nullifier_tag(nullifier, ext),
        1,
    );
}

#[test]
fn test_two_member_tree_right_leaf() {
    let other = 777;
    let nullifier = 11;
    let secret = 22;
    let commitment = note_commitment(nullifier, secret);
    let root = hash_2([other, commitment]);
    let mut indices = [false; MAX_DEPTH];
    indices[0] = true;
    let mut siblings = [0; MAX_DEPTH];
    siblings[0] = other;
    main(nullifier, secret, 1, indices, siblings, root, 5, nullifier_tag(nullifier, 5), 0);
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn test_vote_out_of_range() {
    let commitment = note_commitment(11, 22);
    main(11, 22, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], commitment, 5, nullifier_tag(11, 5), 2);
}

#[test(should_fail_with = "bad nullifier hash")]
fn test_nullifier_bound_to_proposal() {
    let commitment = note_commitment(11, 22);
    main(11, 22, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], commitment, 5, nullifier_tag(11, 6), 1);
}

#[test(should_fail_with = "not a member of the snapshotted tree")]
fn test_non_member() {
    let commitment = note_commitment(11, 22);
    main(11, 23, 0, [false; MAX_DEPTH], [0; MAX_DEPTH], commitment, 5, nullifier_tag(11, 5), 1);
}

// Parity vector: printed so the JS mirror (scripts/lib/crypto.mjs) can be checked
// against it — see scripts/check-parity.mjs.
#[test]
fn test_parity_vector() {
    assert(hash_2([1, 2]) == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
}
