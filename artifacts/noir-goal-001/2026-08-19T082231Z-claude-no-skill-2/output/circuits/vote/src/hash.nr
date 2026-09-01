//! Hashing used by the ballot.
//!
//! Every hash in this system is SHA-256 truncated to its top 31 bytes (248 bits),
//! which is the largest byte-aligned width that always fits in the BN254 field.
//!
//! Why SHA-256 and not Poseidon: the same hash has to be computed in three places
//! -- inside this circuit, inside `MemberRegistry.sol` (which maintains the
//! incremental Merkle tree onchain), and in the members' Node tooling. SHA-256 is
//! a cheap precompile in the EVM (60 gas), is in `std` here and in Node, and needs
//! no hand-ported round constants, so all three implementations agree by
//! construction rather than by careful transcription.

global SHA256_IV: [u32; 8] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
    0x5be0cd19,
];

/// Big-endian pack 4 bytes into a u32 word.
fn word(b: [u8; 64], i: u32) -> u32 {
    (b[4 * i] as u32) * 0x01000000
        + (b[4 * i + 1] as u32) * 0x00010000
        + (b[4 * i + 2] as u32) * 0x00000100
        + (b[4 * i + 3] as u32)
}

/// Take the top 248 bits of a SHA-256 digest as a field element.
fn digest_to_field(state: [u32; 8]) -> Field {
    let mut acc: Field = 0;
    for i in 0..7 {
        acc = acc * 0x100000000 + state[i] as Field;
    }
    // 7 full words (28 bytes) + the top 3 bytes of the last word = 31 bytes.
    acc * 0x1000000 + (state[7] >> 8) as Field
}

/// truncated_sha256(be32(x))
pub fn hash1(x: Field) -> Field {
    let xb: [u8; 32] = x.to_be_bytes();
    let mut block: [u8; 64] = [0; 64];
    for i in 0..32 {
        block[i] = xb[i];
    }
    block[32] = 0x80; // SHA-256 padding for a 32-byte message
    block[62] = 0x01; // length = 256 bits = 0x0100
    let mut m: [u32; 16] = [0; 16];
    for i in 0..16 {
        m[i] = word(block, i);
    }
    digest_to_field(std::hash::sha256_compression(m, SHA256_IV))
}

/// truncated_sha256(be32(left) || be32(right))
pub fn hash2(left: Field, right: Field) -> Field {
    let lb: [u8; 32] = left.to_be_bytes();
    let rb: [u8; 32] = right.to_be_bytes();
    let mut block: [u8; 64] = [0; 64];
    for i in 0..32 {
        block[i] = lb[i];
        block[32 + i] = rb[i];
    }
    let mut m0: [u32; 16] = [0; 16];
    for i in 0..16 {
        m0[i] = word(block, i);
    }
    let state = std::hash::sha256_compression(m0, SHA256_IV);

    // Second block is pure padding for a 64-byte message: 0x80, zeros, then the
    // 64-bit big-endian bit length (512).
    let mut m1: [u32; 16] = [0; 16];
    m1[0] = 0x80000000;
    m1[15] = 512;
    digest_to_field(std::hash::sha256_compression(m1, state))
}

#[test]
fn hashes_are_in_field_range() {
    // 2^248 - anything we produce must be strictly below this.
    let bound: Field =
        452312848583266388373324160190187140051835877600158453279131187530910662656;
    let h = hash2(1, 2);
    assert(h.lt(bound));
    assert(hash1(1).lt(bound));
    assert(h != hash1(1));
}

#[test]
fn matches_reference_vectors() {
    // Cross-checked against Node's `crypto` and against `sha256()` in the EVM;
    // see `test/Hashing.t.sol` and `js/core/hash.js`. If these three ever drift
    // apart, members can no longer prove membership in the onchain tree.
    assert(
        hash1(1)
            == 417480351180718020436416860597467469834589008187459973615800613778564492427,
    );
    assert(
        hash2(1, 2)
            == 379392964215299100032849613015027094718736135941496643568999604296726406161,
    );
}
