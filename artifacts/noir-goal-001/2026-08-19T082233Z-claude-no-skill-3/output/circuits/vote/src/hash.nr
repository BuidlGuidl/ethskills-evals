//! The one hash function used by the whole system.
//!
//! `hash_pair(a, b) = keccak256(be32(a) || be32(b)) >> 8`
//!
//! The 8-bit right shift throws away the top byte, which guarantees the result
//! is < 2^248 < bn254_fr_modulus. So the output is always a canonical field
//! element and the Solidity side can reproduce it with one keccak256 and one
//! shift (`Hash.pair` in src/lib/Hash.sol).

pub fn hash_pair(a: Field, b: Field) -> Field {
    let a_bytes: [u8; 32] = a.to_be_bytes();
    let b_bytes: [u8; 32] = b.to_be_bytes();

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = a_bytes[i];
        preimage[32 + i] = b_bytes[i];
    }

    let digest: [u8; 32] = keccak256::keccak256(preimage, 64);

    // Big-endian re-assembly of the top 31 bytes == uint256(digest) >> 8.
    let mut out: Field = 0;
    for i in 0..31 {
        out = out * 256 + digest[i] as Field;
    }
    out
}

#[test]
fn hash_pair_is_deterministic() {
    assert(hash_pair(1, 2) == hash_pair(1, 2));
    assert(hash_pair(1, 2) != hash_pair(2, 1));
}
