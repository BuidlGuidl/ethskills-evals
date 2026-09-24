// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchPay} from "../src/BatchPay.sol";

contract Token {
    mapping(address => uint256) public balanceOf;
    function mint(address t, uint256 a) external { balanceOf[t] += a; }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        balanceOf[f] -= a; balanceOf[t] += a; return true;
    }
}

/// Guards the boundary between tools/batch.mjs (encoder) and BatchPay (decoder).
/// The calldata here is produced by the real JS encoder and passed in via
/// JS_CALLDATA, so a divergence in packing shows up as a failing test rather
/// than as money sent to the wrong address.
contract CrossCheckTest is Test {
    function test_SolidityDecodesJsEncoding() public {
        Token t = new Token();
        address funder = makeAddr("funder");
        address relayer = makeAddr("relayer");
        BatchPay b = new BatchPay(address(t), funder, address(this));
        b.setRelayer(relayer, true);
        t.mint(funder, type(uint256).max / 2);

        // Golden value recorded from tools/batch.mjs encodeBatch(). CI should
        // override it with freshly generated output so drift in either side is
        // caught:  JS_CALLDATA=$(node tools/gen-crosscheck.mjs) forge test
        bytes memory cd = vm.envOr(
            "JS_CALLDATA",
            bytes(
                hex"00000000000000000000000000000000000000aa000000000000000000000001"
                hex"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                hex"833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000001851960"
            )
        );
        vm.prank(relayer);
        uint256 total = b.pay(cd);

        assertEq(t.balanceOf(0x00000000000000000000000000000000000000AA), 1);
        assertEq(t.balanceOf(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF), type(uint96).max);
        assertEq(t.balanceOf(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913), 25_500_000);
        assertEq(total, 1 + uint256(type(uint96).max) + 25_500_000);
    }
}
