// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;
    address internal member = address(0xBEEF);

    function setUp() public {
        streak = new Streak();
        vm.warp(100 days + 1 hours);
    }

    function testCheckInEmitsAndRecordsUtcDay() public {
        vm.expectEmit(true, true, false, true);
        emit Streak.CheckedIn(member, 100, "gm");
        vm.prank(member);
        streak.checkIn("gm");
        assertEq(streak.lastCheckInDay(member), 100);
    }

    function testCannotCheckInTwiceInUtcDay() public {
        vm.startPrank(member);
        streak.checkIn("");
        vm.warp(101 days - 1);
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedIn.selector, 100));
        streak.checkIn("again");
    }

    function testCanCheckInAtNextUtcDay() public {
        vm.prank(member);
        streak.checkIn("");
        vm.warp(101 days);
        vm.prank(member);
        streak.checkIn("next day");
        assertEq(streak.lastCheckInDay(member), 101);
    }

    function testRejectsNotesOver280Bytes() public {
        string memory note = new string(281);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 281, 280));
        vm.prank(member);
        streak.checkIn(note);
    }
}
