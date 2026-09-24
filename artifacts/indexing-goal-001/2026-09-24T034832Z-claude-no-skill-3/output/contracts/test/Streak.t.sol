// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    event CheckedIn(address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note);

    function setUp() public {
        // Start at a known UTC-midnight-aligned-ish timestamp: 2025-01-01 12:00 UTC.
        vm.warp(1_735_732_800);
        streak = new Streak();
    }

    function _day() internal view returns (uint32) {
        return uint32(vm.getBlockTimestamp() / 1 days);
    }

    function test_FirstCheckInStartsStreakAtOne() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, _day(), 1, 1, "gm");
        streak.checkIn("gm");

        assertEq(streak.streakOf(alice), 1);
        assertEq(streak.totalOf(alice), 1);
        assertEq(streak.totalCheckIns(), 1);
        assertEq(streak.totalMembers(), 1);
    }

    function test_SecondCheckInSameDayReverts() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, _day()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_LaterSameDayStillReverts() public {
        vm.startPrank(alice);
        streak.checkIn();
        // Move forward within the same UTC day.
        vm.warp(vm.getBlockTimestamp() + 11 hours);
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, _day()));
        streak.checkIn();
        vm.stopPrank();
    }

    function test_ConsecutiveDaysIncrementStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn("");
            assertEq(streak.streakOf(alice), uint32(i + 1));
            vm.warp(vm.getBlockTimestamp() + 1 days);
        }
        assertEq(streak.totalOf(alice), 5);
        assertEq(streak.streakOf(alice), 5); // yesterday's streak is still live
    }

    function test_MissedDayResetsStreak() public {
        vm.prank(alice);
        streak.checkIn("");
        vm.warp(vm.getBlockTimestamp() + 2 days);

        // The old streak is no longer live even before the next check-in.
        assertEq(streak.streakOf(alice), 0);

        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.streakOf(alice), 1);
        assertEq(streak.totalOf(alice), 2);
    }

    function test_CheckInAcrossMidnightCounts() public {
        vm.warp((uint256(_day()) * 1 days) + 23 hours + 59 minutes);
        vm.prank(alice);
        streak.checkIn("");
        vm.warp(vm.getBlockTimestamp() + 2 minutes); // next UTC day, one minute later
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.streakOf(alice), 2);
    }

    function test_NoteTooLongReverts() public {
        string memory note = new string(141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141, 140));
        streak.checkIn(note);
    }

    function test_MaxLengthNoteAccepted() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        assertEq(streak.totalOf(alice), 1);
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("a");
        vm.prank(bob);
        streak.checkIn("b");
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(alice);
        streak.checkIn("a2");

        assertEq(streak.streakOf(alice), 2);
        assertEq(streak.streakOf(bob), 1); // bob's day-1 streak is still live today
        vm.warp(vm.getBlockTimestamp() + 1 days);
        assertEq(streak.streakOf(bob), 0); // ...but not the day after
        assertEq(streak.totalCheckIns(), 3);
        assertEq(streak.totalMembers(), 2);
    }

    function test_CanCheckIn() public {
        assertTrue(streak.canCheckIn(alice));
        vm.prank(alice);
        streak.checkIn("");
        assertFalse(streak.canCheckIn(alice));
        vm.warp(vm.getBlockTimestamp() + 1 days);
        assertTrue(streak.canCheckIn(alice));
    }

    function test_ProfileOf() public {
        vm.prank(alice);
        streak.checkIn("");
        uint32 first = _day();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(alice);
        streak.checkIn("");
        vm.warp(vm.getBlockTimestamp() + 5 days);

        (uint32 live, uint32 best, uint32 total, uint32 lastDay, uint32 firstDay) = streak.profileOf(alice);
        assertEq(live, 0);
        assertEq(best, 2);
        assertEq(total, 2);
        assertEq(lastDay, first + 1);
        assertEq(firstDay, first);
    }

    function testFuzz_NoteRoundTrips(string calldata note) public {
        vm.assume(bytes(note).length <= 140);
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, _day(), 1, 1, note);
        streak.checkIn(note);
    }
}
