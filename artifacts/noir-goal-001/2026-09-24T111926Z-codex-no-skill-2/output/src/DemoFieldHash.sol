// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library DemoFieldHash {
    uint256 internal constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    uint256 private constant C0 = 1234567890123456789012345678901234567890;
    uint256 private constant C1 = 987654321098765432109876543210987654321;
    uint256 private constant C2 = 192837465564738291019283746556473829101;
    uint256 private constant C3 = 918273645546372819009182736455463728190;
    uint256 private constant C4 = 112233445566778899001122334455667788990;
    uint256 private constant C5 = 998877665544332211009988776655443322110;
    uint256 private constant C6 = 314159265358979323846264338327950288419;
    uint256 private constant C7 = 271828182845904523536028747135266249775;
    uint256 private constant C8 = 161803398874989484820458683436563811772;
    uint256 private constant C9 = 141421356237309504880168872420969807856;

    function hash2(uint256 left, uint256 right) internal pure returns (uint256) {
        uint256 state = addmod(addmod(left, mulmod(right, C0, FIELD_MODULUS), FIELD_MODULUS), C1, FIELD_MODULUS);
        state = pow5(addmod(addmod(addmod(state, mulmod(left, C2, FIELD_MODULUS), FIELD_MODULUS), mulmod(right, C3, FIELD_MODULUS), FIELD_MODULUS), C4, FIELD_MODULUS));
        state = pow5(addmod(addmod(addmod(state, mulmod(left, C5, FIELD_MODULUS), FIELD_MODULUS), mulmod(right, C6, FIELD_MODULUS), FIELD_MODULUS), C7, FIELD_MODULUS));
        state = pow5(addmod(addmod(addmod(state, mulmod(left, C8, FIELD_MODULUS), FIELD_MODULUS), mulmod(right, C9, FIELD_MODULUS), FIELD_MODULUS), C0, FIELD_MODULUS));
        return state;
    }

    function pow5(uint256 x) private pure returns (uint256) {
        uint256 x2 = mulmod(x, x, FIELD_MODULUS);
        uint256 x4 = mulmod(x2, x2, FIELD_MODULUS);
        return mulmod(x4, x, FIELD_MODULUS);
    }
}

