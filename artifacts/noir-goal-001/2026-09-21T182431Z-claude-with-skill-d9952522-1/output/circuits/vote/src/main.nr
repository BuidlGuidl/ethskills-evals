// Anonymous yes/no vote.
//
// A member proves: "I know the secrets behind one leaf of the member tree whose
// root is `root`, and `nullifier_hash` is the one-per-proposal tag derived from
// those secrets and `scope`." Nothing public identifies which leaf.
//
// Hash: Poseidon (circomlib-compatible, BN254, t=3). The same function is used by
// PoseidonT3 in the contracts and by poseidon-lite in the Node client.
use poseidon::poseidon::bn254::hash_2;

// 2^10 = 1024 leaves; the DAO has ~150 members, room to grow.
global DEPTH: u32 = 10;

fn main(
    // ---- public inputs (order matters: contract passes them in this order) ----
    root: pub Field,           // member tree root snapshotted by the proposal
    scope: pub Field,          // per-proposal external nullifier (chain, contract, proposalId)
    vote: pub Field,           // 1 = yes, 0 = no
    nullifier_hash: pub Field, // hash_2(identity_nullifier, scope)
    // ---- private inputs ----
    identity_nullifier: Field,
    identity_trapdoor: Field,
    path: [Field; DEPTH],
    indices: [bool; DEPTH],    // true = current node is the right child
) {
    // Vote is a single bit.
    assert(vote * (vote - 1) == 0);

    // Leaf = identity commitment registered onchain by the member's wallet.
    let mut node = hash_2([identity_nullifier, identity_trapdoor]);
    for i in 0..DEPTH {
        let (left, right) = if indices[i] { (path[i], node) } else { (node, path[i]) };
        node = hash_2([left, right]);
    }
    assert(node == root);

    // One nullifier per (member, proposal); unlinkable across proposals.
    assert(hash_2([identity_nullifier, scope]) == nullifier_hash);
}

#[test]
fn test_single_member_tree() {
    let n = 12345;
    let t = 67890;
    let mut node = hash_2([n, t]);
    let mut path = [0; DEPTH];
    let mut zero = 0;
    for i in 0..DEPTH {
        path[i] = zero;
        node = hash_2([node, zero]);
        zero = hash_2([zero, zero]);
    }
    let scope = 42;
    main(node, scope, 1, hash_2([n, scope]), n, t, path, [false; DEPTH]);
}

#[test(should_fail)]
fn test_vote_not_bit() {
    let n = 1;
    let t = 2;
    let mut node = hash_2([n, t]);
    let mut path = [0; DEPTH];
    let mut zero = 0;
    for i in 0..DEPTH {
        path[i] = zero;
        node = hash_2([node, zero]);
        zero = hash_2([zero, zero]);
    }
    main(node, 7, 2, hash_2([n, 7]), n, t, path, [false; DEPTH]);
}
