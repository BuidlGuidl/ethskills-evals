//! Anonymous DAO ballot circuit.
//!
//! Proves: "I know the secret behind SOME commitment in the member Merkle tree,
//! and this is my one and only vote on this proposal" -- without revealing WHICH
//! commitment, i.e. which member.
//!
//! Hashing is keccak256 truncated to 248 bits so that the Merkle tree can be
//! rebuilt identically in Solidity (`uint256(keccak256(...)) >> 8`). Dropping the
//! low byte keeps every digest below the BN254 field modulus, so a digest is
//! always a valid Field element with no modular reduction ambiguity.

use keccak256::keccak256;

global DEPTH: u32 = 8; // 2^8 = 256 member slots (DAO has ~150)

// Domain tags keep the commitment and the nullifier in disjoint hash spaces.
// Without this, a proposal id colliding with the commitment's second operand
// would make nullifier == commitment and deanonymise the voter instantly,
// because commitments are public on-chain.
global TAG_COMMITMENT: Field = 1;
global TAG_NULLIFIER: Field = 2;

/// keccak256 digest truncated to its top 248 bits (== solidity `>> 8`).
fn truncate(h: [u8; 32]) -> Field {
    let mut acc: Field = 0;
    for i in 0..31 {
        acc = acc * 256 + h[i] as Field;
    }
    acc
}

/// Merkle node hash. Mirrors `MerkleTree.hashPair` in Solidity.
fn hash_pair(left: Field, right: Field) -> Field {
    let mut input: [u8; 64] = [0; 64];
    let l: [u8; 32] = left.to_be_bytes();
    let r: [u8; 32] = right.to_be_bytes();
    for i in 0..32 {
        input[i] = l[i];
        input[32 + i] = r[i];
    }
    truncate(keccak256(input, 64))
}

/// Domain-separated 2-operand hash. Mirrors `Hashes.tagged` in Solidity/JS.
fn tagged_hash(tag: Field, a: Field, b: Field) -> Field {
    let mut input: [u8; 96] = [0; 96];
    let t: [u8; 32] = tag.to_be_bytes();
    let x: [u8; 32] = a.to_be_bytes();
    let y: [u8; 32] = b.to_be_bytes();
    for i in 0..32 {
        input[i] = t[i];
        input[32 + i] = x[i];
        input[64 + i] = y[i];
    }
    truncate(keccak256(input, 96))
}

fn main(
    // --- public inputs, in this exact order -> HonkVerifier publicInputs[] ---
    root: pub Field, // member set snapshotted when the proposal was created
    proposal_id: pub Field, // which proposal this vote is for
    nullifier: pub Field, // spend-once tag, unlinkable to the member
    vote: pub Field, // 0 = no, 1 = yes
    // --- private witness: never leaves the member's machine ---
    secret: Field, // the member's voting secret
    path: [Field; DEPTH], // sibling hashes from leaf to root
    leaf_index: u8, // position of the member's commitment in the tree
) {
    // A vote must be exactly 0 or 1, otherwise a member could add 7 to the
    // "yes" tally by passing vote = 7.
    assert(vote * (vote - 1) == 0, "vote must be 0 or 1");

    // The public commitment the member registered on-chain.
    let commitment = tagged_hash(TAG_COMMITMENT, secret, 0);

    // Walk the Merkle path. `leaf_index` is a u8, so it is range-constrained to
    // exactly DEPTH bits by construction.
    let bits: [bool; DEPTH] = (leaf_index as Field).to_le_bits();
    let mut node = commitment;
    for i in 0..DEPTH {
        let sibling = path[i];
        // bits[i] == true  => our node sits on the right at this level
        let left = if bits[i] { sibling } else { node };
        let right = if bits[i] { node } else { sibling };
        node = hash_pair(left, right);
    }
    assert(node == root, "commitment is not in the member set");

    // Bind the nullifier to (secret, proposal). Deterministic per proposal, so
    // the contract can reject a second vote; derived through keccak from a
    // secret nobody else knows, so it reveals nothing about which member it is.
    assert(nullifier == tagged_hash(TAG_NULLIFIER, secret, proposal_id), "bad nullifier");
}

// ---------------------------------------------------------------------------
// Cross-implementation tests.
//
// The same vectors are asserted in contracts/test/Hashes.t.sol and produced by
// scripts/common/crypto.mjs. Noir, Solidity and JS must agree on every digest: the
// member builds a Merkle path in JS against a root computed in Solidity, and
// proves it in Noir. A drift in any one of them makes every proof unverifiable.
// ---------------------------------------------------------------------------

#[test]
fn hash_pair_matches_reference_vector() {
    assert(hash_pair(1, 2) == 0x00e90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2);
}

#[test]
fn commitment_matches_reference_vector() {
    assert(
        tagged_hash(TAG_COMMITMENT, 123, 0)
            == 0x00744ed4ac598dcd81b2fcd63d97a372ea02960ead3e516cc577bec497f7bac8,
    );
}

#[test]
fn nullifier_matches_reference_vector() {
    assert(
        tagged_hash(TAG_NULLIFIER, 123, 1)
            == 0x00338bdef32ebeccb1e0b56404b21374626328f1064eaff8e590f1f35fbdc341,
    );
}

/// The domain tags must keep a member's public commitment and their published
/// nullifier apart. If these ever collided, the vote would name the voter.
#[test]
fn commitment_and_nullifier_are_domain_separated() {
    assert(tagged_hash(TAG_COMMITMENT, 77, 0) != tagged_hash(TAG_NULLIFIER, 77, 0));
}

/// Walks the same 3-leaf tree that contracts/test/MemberRegistry.t.sol registers
/// on-chain, from the leaf at index 1 (commitment 222).
#[test]
fn merkle_path_reaches_the_solidity_root() {
    let path: [Field; DEPTH] = [
        0x000000000000000000000000000000000000000000000000000000000000006f,
        0x0024b76ed536e20e674879e6fda27eaa201af7bf61e9ae4d427dea20d0a619a5,
        0x00964dbd5590a1f3e925e063fadaa5389132386190413b8331f703e91c1f634c,
        0x00f933d68bb8f3b821f7365ffa1bc0e895f3305a6d1fa2cdb66b7477a6bf2664,
        0x003d9aa24f6755c7c7946cafd7ccd698c7a8fbca57f850a2e99df20757cc13b8,
        0x00cd1344ed189f4e99fc0d1ad925f650a02c33020edb7417c99e3017a80d4dc1,
        0x000cc20c3f8a0d43c288894792ae3f677a4c43c55e00167fa4e50ff3365338fe,
        0x007621e49ef77c78990de143ec5d812d0c9125400a457cc53282e958da88d278,
    ];

    let bits: [bool; DEPTH] = (1 as Field).to_le_bits();
    let mut node: Field = 222;
    for i in 0..DEPTH {
        let left = if bits[i] { path[i] } else { node };
        let right = if bits[i] { node } else { path[i] };
        node = hash_pair(left, right);
    }
    assert(node == 0x0030c8b9bd40429ed2d866bf512776c57fea13dbdd1db56b3114bece881ab55c);
}

// --- soundness: what the circuit must refuse to prove -----------------------
//
// Same scenario as contracts/test/PrivateBallot.t.sol: members with secrets
// 1, 2, 3 have registered; the holder of secret 1 sits at leaf 0.

global TEST_ROOT: Field = 0x00acf6d4bf8a22a4e3412d7a79cd4d17b00bfc0bcf1345d880af8e4733cb8c19;
global TEST_NULLIFIER: Field = 0x00df92d62175d67607cc8aab61268e34e39c3407c7a4b2b2b172f05931f43d44;
global TEST_PATH: [Field; DEPTH] = [
    0x0025709ff08e817e4d69c96350c24d3b65079a6416b07e8b7414e2a5a270a726,
    0x003b47ce36ad6b8d63ee583aabfe02907d1a55999c1cbce57679a84c73d2072f,
    0x00964dbd5590a1f3e925e063fadaa5389132386190413b8331f703e91c1f634c,
    0x00f933d68bb8f3b821f7365ffa1bc0e895f3305a6d1fa2cdb66b7477a6bf2664,
    0x003d9aa24f6755c7c7946cafd7ccd698c7a8fbca57f850a2e99df20757cc13b8,
    0x00cd1344ed189f4e99fc0d1ad925f650a02c33020edb7417c99e3017a80d4dc1,
    0x000cc20c3f8a0d43c288894792ae3f677a4c43c55e00167fa4e50ff3365338fe,
    0x007621e49ef77c78990de143ec5d812d0c9125400a457cc53282e958da88d278,
];

#[test]
fn accepts_a_genuine_member_voting_yes() {
    main(TEST_ROOT, 1, TEST_NULLIFIER, 1, 1, TEST_PATH, 0);
}

/// A member may vote no with the same membership evidence; only the public
/// `vote` input changes.
#[test]
fn accepts_a_genuine_member_voting_no() {
    main(TEST_ROOT, 1, TEST_NULLIFIER, 0, 1, TEST_PATH, 0);
}

/// Ballot stuffing via an out-of-range vote: `vote = 7` would otherwise add 7
/// to a tally that only ever adds a public input.
#[test(should_fail_with = "vote must be 0 or 1")]
fn rejects_a_vote_that_is_not_zero_or_one() {
    main(TEST_ROOT, 1, TEST_NULLIFIER, 7, 1, TEST_PATH, 0);
}

/// Somebody who never registered cannot produce a proof, whatever they claim.
#[test(should_fail_with = "commitment is not in the member set")]
fn rejects_a_non_member() {
    main(TEST_ROOT, 1, TEST_NULLIFIER, 1, 999999, TEST_PATH, 0);
}

/// A member cannot pick a fresh nullifier per vote to vote twice.
#[test(should_fail_with = "bad nullifier")]
fn rejects_a_nullifier_the_member_made_up() {
    main(TEST_ROOT, 1, TEST_NULLIFIER + 1, 1, 1, TEST_PATH, 0);
}

/// The nullifier is bound to the proposal, so a proof cannot be re-aimed at a
/// different proposal to vote there for free.
#[test(should_fail_with = "bad nullifier")]
fn rejects_a_nullifier_from_another_proposal() {
    main(TEST_ROOT, 2, TEST_NULLIFIER, 1, 1, TEST_PATH, 0);
}
