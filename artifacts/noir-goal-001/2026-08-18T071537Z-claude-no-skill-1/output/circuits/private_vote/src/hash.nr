//! Hashing used by the member tree, the commitments and the nullifiers.
//!
//! Everything is keccak256 truncated to its low 248 bits. Truncation is what
//! makes a keccak digest safe to treat as a BN254 field element (2^248 < p),
//! and it is the reason the *same* tree can be rebuilt inside Solidity with
//! nothing but the native keccak256 opcode -- no Poseidon library, and so no
//! off-chain root that anyone has to be trusted for.
//!
//! Solidity equivalent:  uint256(keccak256(abi.encodePacked(..))) & MASK_248

/// Truncate a 32-byte keccak digest to a field element by zeroing the top byte.
fn truncate(digest: [u8; 32]) -> Field {
    let mut masked: [u8; 32] = [0; 32];
    for i in 1..32 {
        masked[i] = digest[i];
    }
    Field::from_be_bytes::<32>(masked)
}

/// keccak248(a ++ b) -- internal tree nodes and vote commitments.
pub fn hash2(a: Field, b: Field) -> Field {
    let ab: [u8; 32] = a.to_be_bytes();
    let bb: [u8; 32] = b.to_be_bytes();
    let mut buf: [u8; 64] = [0; 64];
    for i in 0..32 {
        buf[i] = ab[i];
        buf[32 + i] = bb[i];
    }
    truncate(keccak256::keccak256(buf, 64))
}

/// keccak248(a ++ b ++ c) -- nullifiers.
pub fn hash3(a: Field, b: Field, c: Field) -> Field {
    let ab: [u8; 32] = a.to_be_bytes();
    let bb: [u8; 32] = b.to_be_bytes();
    let cb: [u8; 32] = c.to_be_bytes();
    let mut buf: [u8; 96] = [0; 96];
    for i in 0..32 {
        buf[i] = ab[i];
        buf[32 + i] = bb[i];
        buf[64 + i] = cb[i];
    }
    truncate(keccak256::keccak256(buf, 96))
}
