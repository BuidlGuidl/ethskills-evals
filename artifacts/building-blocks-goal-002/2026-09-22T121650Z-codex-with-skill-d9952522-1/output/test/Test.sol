// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
}

contract Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "assert eq uint");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "assert eq address");
    }

    function assertGt(uint256 a, uint256 b) internal pure {
        require(a > b, "assert gt");
    }

    function assertTrue(bool value) internal pure {
        require(value, "assert true");
    }
}
