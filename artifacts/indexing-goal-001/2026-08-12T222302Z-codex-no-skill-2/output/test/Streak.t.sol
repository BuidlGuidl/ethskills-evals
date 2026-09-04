// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Streak} from "../contracts/Streak.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes calldata) external;
    function expectRevert(bytes4) external;
}

contract StreakTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Streak streak;
    address member = address(0xBEEF);

    function setUp() public {
        streak = new Streak();
        vm.warp(100 days);
    }

    function testCheckInOncePerUtcDay() public {
        vm.prank(member);
        streak.checkIn("gm");
        assertEq(streak.lastCheckInDay(member), 100);

        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedIn.selector, 100));
        vm.prank(member);
        streak.checkIn("again");

        vm.warp(101 days);
        vm.prank(member);
        streak.checkIn("");
    }

    function testRejectsLongNote() public {
        vm.expectRevert(Streak.NoteTooLong.selector);
        streak.checkIn(string(new bytes(281)));
    }

    function assertEq(uint256 actual, uint256 expected) internal pure {
        require(actual == expected, "not equal");
    }
}
