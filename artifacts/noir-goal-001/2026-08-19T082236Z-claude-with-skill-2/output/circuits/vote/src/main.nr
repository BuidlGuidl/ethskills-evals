// Anonymous DAO ballot.
//
// Proves: "I hold a voter commitment in the Merkle tree snapshotted by this
// proposal, and this is my one ballot for it" — without revealing which leaf.
//
// Public inputs are consumed onchain in exactly this order. If you reorder
// them here you must reorder them in AnonVoting.sol and js/lib/prove.mjs too.
use poseidon::poseidon::bn254::hash_2;

// 2^10 = 1024 leaves. Comfortable for a 150-member DAO with room to grow.
global TREE_DEPTH: u32 = 10;

fn main(
    // ---- public ----
    root: pub Field, // voter-tree root snapshotted by the proposal
    proposal_id: pub Field, // scopes the nullifier so ballots don't link across proposals
    nullifier_hash: pub Field, // the "already voted" tag the contract stores
    vote: pub Field, // 0 = no, 1 = yes. Public so the tally is plain addition.
    // ---- private ----
    secret: Field, // member's spend secret
    nullifier: Field, // member's nullifier secret
    path_elements: [Field; TREE_DEPTH],
    path_indices: [bool; TREE_DEPTH], // true = current node is the RIGHT child
) {
    // A ballot is a bit. Without this, `vote` could be 7 and stuff the tally.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    // The leaf the member inserted when they joined.
    let commitment = hash_2([secret, nullifier]);

    // Merkle inclusion: same hash, same argument order as VoterRegistry.sol
    // and js/lib/tree.mjs.
    let mut node = commitment;
    for i in 0..TREE_DEPTH {
        let sibling = path_elements[i];
        let (left, right) = if path_indices[i] { (sibling, node) } else { (node, sibling) };
        node = hash_2([left, right]);
    }
    assert(node == root, "voter commitment is not in the snapshotted tree");

    // Binds the double-vote tag to this member AND this proposal. Reusing the
    // raw nullifier across proposals would link a member's whole voting record.
    assert(nullifier_hash == hash_2([nullifier, proposal_id]), "nullifier hash mismatch");
}

#[test]
fn test_depth_one_path() {
    // Hand-built 10-deep path where the member sits at leaf index 0.
    let secret = 11;
    let nullifier = 22;
    let proposal_id = 7;

    let commitment = hash_2([secret, nullifier]);
    let mut node = commitment;
    let path_elements = [3; TREE_DEPTH];
    let path_indices = [false; TREE_DEPTH];
    for i in 0..TREE_DEPTH {
        node = hash_2([node, path_elements[i]]);
    }

    main(
        node,
        proposal_id,
        hash_2([nullifier, proposal_id]),
        1,
        secret,
        nullifier,
        path_elements,
        path_indices,
    );
}
