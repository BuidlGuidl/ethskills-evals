use crate::hash::hash2;

/// Recompute a Merkle root from a leaf and its authentication path.
///
/// `index_bits[i]` is bit `i` of the leaf index: false means the current node is
/// the left child at that level, true means it is the right child. Using the bits as a
/// private input (rather than the index) is what keeps the leaf position -- and
/// therefore the member's identity -- out of the proof.
pub fn compute_root<let DEPTH: u32>(
    leaf: Field,
    index_bits: [bool; DEPTH],
    siblings: [Field; DEPTH],
) -> Field {
    let mut node = leaf;
    for i in 0..DEPTH {
        let sibling = siblings[i];
        let is_right = index_bits[i] as Field;
        // Branchless swap: when is_right == 1 the current node moves to the right.
        let left = node + is_right * (sibling - node);
        let right = sibling + is_right * (node - sibling);
        node = hash2(left, right);
    }
    node
}
