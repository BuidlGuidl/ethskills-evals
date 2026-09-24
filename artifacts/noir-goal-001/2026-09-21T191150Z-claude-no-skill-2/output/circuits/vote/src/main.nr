// Anonymous yes/no vote.
//
// Proves: "I know the secret behind one of the commitments in the member tree
// whose root is `root`, this is my unique nullifier for `scope`, and my
// vote is `vote`" — without revealing which commitment.
//
// Public inputs (order matters, it's the verifier's publicInputs order):
//   root      - member tree root snapshotted when the proposal was created
//   scope     - per-proposal scope computed by the voting contract
//   vote      - 0 = no, 1 = yes
//   nullifier - hash(secret, scope): same member + same proposal => same value,
//               unlinkable across proposals and to the member's commitment
use poseidon::poseidon::bn254::{hash_1, hash_2};

global DEPTH: u32 = 10; // up to 1024 members

fn main(
    identity_secret: Field,
    leaf_index: u32,
    siblings: [Field; DEPTH],
    root: pub Field,
    scope: pub Field,
    vote: pub Field,
    nullifier: pub Field,
) {
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");
    assert(leaf_index < (1 << DEPTH), "leaf index out of range");

    // Membership: the commitment registered onchain is hash_1(secret).
    let mut node = hash_1([identity_secret]);
    for i in 0..DEPTH {
        let is_right = ((leaf_index >> i) & 1) == 1;
        node = if is_right {
            hash_2([siblings[i], node])
        } else {
            hash_2([node, siblings[i]])
        };
    }
    assert(node == root, "not a member of this proposal's snapshot");

    // One vote per member per proposal.
    assert(nullifier == hash_2([identity_secret, scope]), "bad nullifier");
}

#[test]
fn test_single_member_tree() {
    let secret = 0x1234;
    let mut node = hash_1([secret]);
    let mut siblings = [0; DEPTH];
    let mut zero = 0;
    for i in 0..DEPTH {
        siblings[i] = zero;
        node = hash_2([node, zero]);
        zero = hash_2([zero, zero]);
    }
    let scope = 42;
    main(secret, 0, siblings, node, scope, 1, hash_2([secret, scope]));
}

#[test(should_fail_with = "bad nullifier")]
fn test_wrong_nullifier() {
    let secret = 0x1234;
    let mut node = hash_1([secret]);
    let mut siblings = [0; DEPTH];
    let mut zero = 0;
    for i in 0..DEPTH {
        siblings[i] = zero;
        node = hash_2([node, zero]);
        zero = hash_2([zero, zero]);
    }
    main(secret, 0, siblings, node, 42, 0, hash_2([secret, 43]));
}

#[test(should_fail_with = "vote must be 0 or 1")]
fn test_non_binary_vote() {
    main(1, 0, [0; DEPTH], 0, 0, 2, 0);
}
