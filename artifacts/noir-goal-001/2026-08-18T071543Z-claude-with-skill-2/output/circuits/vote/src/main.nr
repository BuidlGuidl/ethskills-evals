use binary_merkle_root::binary_merkle_root;
use poseidon::poseidon::bn254::hash_2;

/// Max depth the circuit can verify. The DAO has ~150 members, so the live
/// LeanIMT depth is ~8; 16 leaves head-room to 65k members without a
/// recompile (and without changing the verifier address).
global MAX_DEPTH: u32 = 16;

/// Hash domain separators. Commitments and nullifiers must live in different
/// domains so a value from one can never be replayed as the other.
global DOMAIN_COMMITMENT: Field = 1;
global DOMAIN_NULLIFIER: Field = 2;

/// Anonymous DAO vote.
///
/// Proves, without revealing which member is speaking:
///   1. "my membership commitment is a leaf of the tree with root `merkle_root`"
///   2. "`nullifier_hash` is the one and only nullifier I can produce for
///       proposal `proposal_id`"
///   3. "`vote` is a valid yes/no choice, and it is bound to this proof"
///
/// `vote` is public: the tally is public, only the *link* to a member is not.
/// It is still constrained here (boolean check), which is what binds it into
/// the proof — a relayer cannot flip a vote in flight without invalidating
/// the proof.
fn main(
    // ---- private witness ----
    identity_nullifier: Field,
    identity_secret: Field,
    // Number of levels actually used by the LeanIMT proof. Lying about it
    // simply yields a different root, so it does not need to be public.
    merkle_depth: u32,
    // 0 = current node is the left child, 1 = right child.
    merkle_indices: [bool; MAX_DEPTH],
    merkle_siblings: [Field; MAX_DEPTH],
    // ---- public inputs (order must match the Solidity call) ----
    merkle_root: pub Field,
    proposal_id: pub Field,
    nullifier_hash: pub Field,
    vote: pub Field,
) {
    // 1. Rebuild the membership commitment from the private identity.
    let commitment = commitment_of(identity_nullifier, identity_secret);

    // 2. Prove it is in the member tree snapshotted by the proposal.
    let computed_root = binary_merkle_root(
        hash_2,
        commitment,
        merkle_depth,
        merkle_indices,
        merkle_siblings,
    );
    assert(computed_root == merkle_root, "not a member of the snapshotted registry");

    // 3. Prove the nullifier is the deterministic one for this proposal, so
    //    the contract can reject a second vote without learning who voted.
    assert(
        nullifier_hash_of(identity_nullifier, proposal_id) == nullifier_hash,
        "nullifier hash mismatch",
    );

    // 4. Constrain the ballot to {0 = no, 1 = yes}.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");
}

/// commitment = H(DOMAIN_COMMITMENT, H(identity_nullifier, identity_secret))
pub fn commitment_of(identity_nullifier: Field, identity_secret: Field) -> Field {
    let identity_hash = hash_2([identity_nullifier, identity_secret]);
    hash_2([DOMAIN_COMMITMENT, identity_hash])
}

/// nullifier_hash = H(H(DOMAIN_NULLIFIER, proposal_id), identity_nullifier)
///
/// Scoped per proposal: one nullifier per (member, proposal), and nullifiers
/// for two different proposals are unlinkable to each other.
pub fn nullifier_hash_of(identity_nullifier: Field, proposal_id: Field) -> Field {
    let scope = hash_2([DOMAIN_NULLIFIER, proposal_id]);
    hash_2([scope, identity_nullifier])
}

mod tests {
    use super::{commitment_of, nullifier_hash_of};
    use poseidon::poseidon::bn254::hash_2;

    /// Anchor for cross-layer hash parity. The same input/output pair is
    /// asserted against PoseidonT3 in test/HashParity.t.sol and against
    /// poseidon-lite in client/make-fixtures.mjs. If any layer ever swaps
    /// Poseidon for Poseidon2, exactly one of the three starts failing.
    #[test]
    fn poseidon_parity_anchor() {
        assert(
            hash_2([1, 2])
                == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a,
        );
    }

    #[test]
    fn commitment_is_domain_separated() {
        let n = 11;
        let s = 22;
        // A raw identity hash must never collide with a commitment.
        assert(commitment_of(n, s) != hash_2([n, s]));
    }

    #[test]
    fn nullifier_is_scoped_per_proposal() {
        let n = 11;
        assert(nullifier_hash_of(n, 1) != nullifier_hash_of(n, 2));
    }

    #[test]
    fn accepts_a_valid_two_member_proof() {
        // Two-leaf tree: root = H(leaf0, leaf1).
        let me = commitment_of(11, 22);
        let other = commitment_of(33, 44);
        let root = hash_2([me, other]);

        let indices = [false; 16];
        let mut siblings = [0; 16];
        siblings[0] = other; // I am the left child at level 0.

        super::main(11, 22, 1, indices, siblings, root, 7, nullifier_hash_of(11, 7), 1);
    }

    #[test(should_fail_with = "vote must be 0 or 1")]
    fn rejects_out_of_range_vote() {
        let me = commitment_of(11, 22);
        let other = commitment_of(33, 44);
        let root = hash_2([me, other]);
        let indices = [false; 16];
        let mut siblings = [0; 16];
        siblings[0] = other;

        super::main(11, 22, 1, indices, siblings, root, 7, nullifier_hash_of(11, 7), 2);
    }

    #[test(should_fail_with = "not a member of the snapshotted registry")]
    fn rejects_a_non_member() {
        let me = commitment_of(11, 22);
        let other = commitment_of(33, 44);
        let root = hash_2([me, other]);
        let indices = [false; 16];
        let mut siblings = [0; 16];
        siblings[0] = other;

        // Same tree, but proving with an identity that is not in it.
        super::main(99, 98, 1, indices, siblings, root, 7, nullifier_hash_of(99, 7), 1);
    }
}
