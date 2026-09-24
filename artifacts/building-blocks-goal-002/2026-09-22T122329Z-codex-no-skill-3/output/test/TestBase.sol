// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function expectRevert(bytes4 revertData) external;
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
}

contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        if (actual != expected) {
            revert(string.concat(message, ": uint mismatch"));
        }
    }

    function assertEq(address actual, address expected, string memory message) internal pure {
        if (actual != expected) {
            revert(string.concat(message, ": address mismatch"));
        }
    }

    function assertGt(uint256 actual, uint256 floor, string memory message) internal pure {
        if (actual <= floor) {
            revert(string.concat(message, ": not greater"));
        }
    }

    function assertApproxEqAbs(uint256 actual, uint256 expected, uint256 maxDelta, string memory message)
        internal
        pure
    {
        uint256 delta = actual > expected ? actual - expected : expected - actual;
        if (delta > maxDelta) {
            revert(string.concat(message, ": outside tolerance"));
        }
    }
}

