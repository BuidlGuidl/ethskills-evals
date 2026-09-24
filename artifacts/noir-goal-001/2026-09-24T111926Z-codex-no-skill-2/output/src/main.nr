fn pow5(x: Field) -> Field {
    let x2 = x * x;
    let x4 = x2 * x2;
    x4 * x
}

fn hash2(left: Field, right: Field) -> Field {
    let c0 = 1234567890123456789012345678901234567890;
    let c1 = 987654321098765432109876543210987654321;
    let c2 = 192837465564738291019283746556473829101;
    let c3 = 918273645546372819009182736455463728190;
    let c4 = 112233445566778899001122334455667788990;
    let c5 = 998877665544332211009988776655443322110;
    let c6 = 314159265358979323846264338327950288419;
    let c7 = 271828182845904523536028747135266249775;
    let c8 = 161803398874989484820458683436563811772;
    let c9 = 141421356237309504880168872420969807856;

    let mut state = left + right * c0 + c1;
    state = pow5(state + left * c2 + right * c3 + c4);
    state = pow5(state + left * c5 + right * c6 + c7);
    state = pow5(state + left * c8 + right * c9 + c0);
    state
}

fn main(
    root: pub Field,
    proposal_id: pub Field,
    nullifier: pub Field,
    vote: pub Field,
    secret: Field,
    path: [Field; 8],
    path_indices: [Field; 8],
) {
    assert(vote * (vote - 1) == 0);

    let leaf = hash2(secret, 1);
    let expected_nullifier = hash2(secret, proposal_id);
    assert(expected_nullifier == nullifier);

    let mut node = leaf;
    for i in 0..8 {
        let bit = path_indices[i];
        assert(bit * (bit - 1) == 0);

        let sibling = path[i];
        let left = node * (1 - bit) + sibling * bit;
        let right = sibling * (1 - bit) + node * bit;
        node = hash2(left, right);
    }

    assert(node == root);
}

