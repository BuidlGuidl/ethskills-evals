// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak private streak;
    address private member = address(0xA11CE);

    function setUp() external { streak = new Streak(); }

    function testCheckInOncePerUtcDay() external {
        vm.warp(10 days + 1 hours);
        vm.prank(member);
        streak.checkIn("gm");
        assertTrue(streak.hasCheckedInToday(member));

        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedIn.selector, 10));
        vm.prank(member);
        streak.checkIn("again");

        vm.warp(11 days);
        vm.prank(member);
        streak.checkIn("new day");
    }

    function testRejectsOversizedNote() external {
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 281));
        streak.checkIn(string(new bytes(281)));
    }
}
