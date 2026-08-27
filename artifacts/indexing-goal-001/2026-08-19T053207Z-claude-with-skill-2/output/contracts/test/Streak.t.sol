// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    event CheckedIn(address indexed member, uint32 indexed day, uint64 timestamp, string note);

    function setUp() public {
        streak = new Streak();
        // Somewhere in 2026, mid-day, so day boundaries are not coincidental.
        vm.warp(1_776_000_000);
    }

    function test_CheckInEmitsEventWithNote() public {
        uint32 day = streak.currentDay();

        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, day, uint64(block.timestamp), "gm");

        vm.prank(alice);
        streak.checkIn("gm");

        assertEq(streak.lastCheckInDay(alice), day);
    }

    function test_CheckInWithoutNote() public {
        vm.prank(alice);
        streak.checkIn();
        assertEq(streak.lastCheckInDay(alice), streak.currentDay());
    }

    function test_RevertWhen_CheckingInTwiceOnSameDay() public {
        vm.startPrank(alice);
        streak.checkIn("gm");

        // Later the same UTC day.
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, streak.currentDay()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_CheckInAgainNextDay() public {
        vm.prank(alice);
        streak.checkIn("day one");

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        streak.checkIn("day two");

        assertEq(streak.lastCheckInDay(alice), streak.currentDay());
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("gm");

        assertFalse(streak.canCheckIn(alice));
        assertTrue(streak.canCheckIn(bob));

        vm.prank(bob);
        streak.checkIn("gm");
        assertFalse(streak.canCheckIn(bob));
    }

    function test_RevertWhen_NoteTooLong() public {
        string memory note = new string(141);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141));
        vm.prank(alice);
        streak.checkIn(note);
    }

    function test_NoteAtMaxLengthIsAccepted() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        assertEq(streak.lastCheckInDay(alice), streak.currentDay());
    }

    function testFuzz_CurrentDayIsUtcDayIndex(uint32 timestamp) public {
        vm.warp(timestamp);
        assertEq(streak.currentDay(), timestamp / 1 days);
    }
}
