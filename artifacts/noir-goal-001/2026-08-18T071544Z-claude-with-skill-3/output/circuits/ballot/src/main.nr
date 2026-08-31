use binary_merkle_root::binary_merkle_root;
use poseidon::poseidon::bn254::hash_2;

// Max supported anonymity-set depth. 16 -> up to 65_536 registered members.
// The DAO has 150 members (actual LeanIMT depth 8); unused levels are padded.
global MAX_DEPTH: u32 = 16;

// Hash domain separators. Commitments and nullifiers must never collide.
global DOMAIN_COMMITMENT: Field = 1;
global DOMAIN_NULLIFIER: Field = 2;

/// One anonymous ballot.
///
/// Proves: "I know the secret behind one of the identity commitments in the
/// member tree pinned by `merkle_root`, this is the first time that identity
/// votes on `proposal_id`, and the ballot is `vote`."
///
/// It does NOT reveal which commitment. `nullifier_hash` is deterministic per
/// (identity, proposal) so the contract can reject a second ballot, but it is
/// unlinkable to the commitment and uncorrelatable across proposals.
fn main(
    // --- private ---
    identity_nullifier: Field, // secret A: seeds the per-proposal nullifier
    identity_trapdoor: Field, // secret B: blinds the commitment
    merkle_depth: u32, // actual depth of the LeanIMT proof
    merkle_indices: [bool; MAX_DEPTH], // false = current node is left child, true = right
    merkle_siblings: [Field; MAX_DEPTH],
    // --- public ---
    merkle_root: pub Field, // member set snapshotted when the proposal opened
    proposal_id: pub Field,
    nullifier_hash: pub Field,
    vote: pub Field, // 0 = no, 1 = yes
) {
    // 1. Ballot must be a bit. Also binds the choice into the proof, so a
    //    relayer forwarding this ballot cannot flip it.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    // 2. Rebuild the identity commitment from the two secrets.
    let identity_secret = hash_2([identity_nullifier, identity_trapdoor]);
    let commitment = hash_2([DOMAIN_COMMITMENT, identity_secret]);

    // 3. That commitment must sit in the pinned member tree.
    let computed_root = binary_merkle_root(
        hash_2,
        commitment,
        merkle_depth,
        merkle_indices,
        merkle_siblings,
    );
    assert(computed_root == merkle_root, "not a registered member of this proposal's snapshot");

    // 4. Nullifier is scoped to this proposal: same identity votes once here,
    //    but its ballots on other proposals are not linkable to this one.
    let scope = hash_2([DOMAIN_NULLIFIER, proposal_id]);
    let computed_nullifier_hash = hash_2([scope, identity_nullifier]);
    assert(computed_nullifier_hash == nullifier_hash, "nullifier hash mismatch");
}

#[test]
fn test_single_member_tree() {
    // Tree with one leaf: root == leaf, depth 0.
    let identity_nullifier = 111;
    let identity_trapdoor = 222;
    let proposal_id = 7;

    let commitment = hash_2(
        [DOMAIN_COMMITMENT, hash_2([identity_nullifier, identity_trapdoor])],
    );
    let scope = hash_2([DOMAIN_NULLIFIER, proposal_id]);
    let nullifier_hash = hash_2([scope, identity_nullifier]);

    main(
        identity_nullifier,
        identity_trapdoor,
        0,
        [false; MAX_DEPTH],
        [0; MAX_DEPTH],
        commitment,
        proposal_id,
        nullifier_hash,
        1,
    );
}

#[test]
fn test_two_member_tree_right_leaf() {
    let identity_nullifier = 333;
    let identity_trapdoor = 444;
    let proposal_id = 9;

    let commitment = hash_2(
        [DOMAIN_COMMITMENT, hash_2([identity_nullifier, identity_trapdoor])],
    );
    let sibling = hash_2([DOMAIN_COMMITMENT, hash_2([1, 2])]);
    let root = hash_2([sibling, commitment]); // our leaf is the right child

    let mut indices = [false; MAX_DEPTH];
    indices[0] = true;
    let mut siblings = [0; MAX_DEPTH];
    siblings[0] = sibling;

    let scope = hash_2([DOMAIN_NULLIFIER, proposal_id]);
    let nullifier_hash = hash_2([scope, identity_nullifier]);

    main(
        identity_nullifier,
        identity_trapdoor,
        1,
        indices,
        siblings,
        root,
        proposal_id,
        nullifier_hash,
        0,
    );
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn test_rejects_non_binary_vote() {
    let identity_nullifier = 111;
    let identity_trapdoor = 222;
    let commitment = hash_2(
        [DOMAIN_COMMITMENT, hash_2([identity_nullifier, identity_trapdoor])],
    );
    let scope = hash_2([DOMAIN_NULLIFIER, 7]);
    main(
        identity_nullifier,
        identity_trapdoor,
        0,
        [false; MAX_DEPTH],
        [0; MAX_DEPTH],
        commitment,
        7,
        hash_2([scope, identity_nullifier]),
        2,
    );
}

#[test(should_fail_with = "not a registered member")]
fn test_rejects_non_member() {
    let scope = hash_2([DOMAIN_NULLIFIER, 7]);
    main(
        999,
        888,
        0,
        [false; MAX_DEPTH],
        [0; MAX_DEPTH],
        12345, // root of a tree we are not in
        7,
        hash_2([scope, 999]),
        1,
    );
}

// Prints reference hashes used by scripts/hash-parity.mjs and contracts/test/HashParity.t.sol
// to assert that Noir, poseidon-lite (JS) and PoseidonT3 (Solidity) agree.
#[test]
fn print_parity_vectors() {
    println(hash_2([1, 2]));
    println(hash_2([DOMAIN_COMMITMENT, hash_2([111, 222])]));
    println(hash_2([hash_2([DOMAIN_NULLIFIER, 7]), 111]));
}
