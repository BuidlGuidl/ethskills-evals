// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    event CheckedIn(
        address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note
    );

    function setUp() public {
        streak = new Streak();
        // Start somewhere in the middle of a day so day boundaries are explicit.
        vm.warp(1_700_000_000);
    }

    function _warpDays(uint256 count) internal {
        vm.warp(block.timestamp + count * 1 days);
    }

    function test_FirstCheckInStartsStreakAtOne() public {
        vm.prank(alice);
        streak.checkIn("gm");

        (uint32 lastDay, uint32 firstDay, uint32 s, uint32 longest, uint32 total) =
            streak.members(alice);
        assertEq(lastDay, streak.today());
        assertEq(firstDay, streak.today());
        assertEq(s, 1);
        assertEq(longest, 1);
        assertEq(total, 1);
        assertEq(streak.totalCheckIns(), 1);
        assertEq(streak.totalMembers(), 1);
    }

    function test_EmitsEverythingTheIndexerNeeds() public {
        uint32 day = streak.today();

        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, day, 1, 1, "shipped the docs");

        vm.prank(alice);
        streak.checkIn("shipped the docs");
    }

    function test_ConsecutiveDaysExtendStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _warpDays(1);
        }

        (,, uint32 s, uint32 longest, uint32 total) = streak.members(alice);
        assertEq(s, 5);
        assertEq(longest, 5);
        assertEq(total, 5);
    }

    function test_GapResetsStreakButKeepsTotalAndLongest() public {
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _warpDays(1);
        }

        _warpDays(2); // miss two days

        vm.prank(alice);
        streak.checkIn("back");

        (,, uint32 s, uint32 longest, uint32 total) = streak.members(alice);
        assertEq(s, 1, "streak restarts");
        assertEq(longest, 3, "longest is remembered");
        assertEq(total, 4, "total keeps counting");
    }

    function test_RevertsOnSecondCheckInSameDay() public {
        vm.startPrank(alice);
        streak.checkIn("gm");

        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedIn.selector, streak.today()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_AllowsCheckInImmediatelyAfterDayBoundary() public {
        // Land at 23:59:59 UTC, check in, then cross into the next day.
        // Flooring to midnight is the point, so the division comes first.
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 dayStart = (block.timestamp / 1 days) * 1 days;
        vm.warp(dayStart + 1 days - 1);

        vm.prank(alice);
        streak.checkIn("late");

        vm.warp(dayStart + 1 days);

        vm.prank(alice);
        streak.checkIn("early");

        (,, uint32 s,, uint32 total) = streak.members(alice);
        assertEq(s, 2, "two seconds apart, but two UTC days");
        assertEq(total, 2);
    }

    function test_RevertsOnOverlongNote() public {
        string memory note = new string(141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141));
        streak.checkIn(note);
    }

    function test_AcceptsNoteAtExactlyMaxLength() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        (,,,, uint32 total) = streak.members(alice);
        assertEq(total, 1);
    }

    function test_MembersAreCountedOnce() public {
        vm.prank(alice);
        streak.checkIn("");
        vm.prank(bob);
        streak.checkIn("");
        _warpDays(1);
        vm.prank(alice);
        streak.checkIn("");

        assertEq(streak.totalMembers(), 2);
        assertEq(streak.totalCheckIns(), 3);
    }

    function test_CurrentStreakOfDecaysAfterAMissedDay() public {
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.currentStreakOf(alice), 1, "checked in today");

        _warpDays(1);
        assertEq(streak.currentStreakOf(alice), 1, "yesterday still counts, today is pending");

        _warpDays(1);
        assertEq(streak.currentStreakOf(alice), 0, "two days of silence lapses the streak");
    }

    function test_CurrentStreakOfIsZeroForUnknownMember() public view {
        assertEq(streak.currentStreakOf(bob), 0);
    }

    function test_HasCheckedInToday() public {
        assertFalse(streak.hasCheckedInToday(alice));
        vm.prank(alice);
        streak.checkIn("");
        assertTrue(streak.hasCheckedInToday(alice));
        _warpDays(1);
        assertFalse(streak.hasCheckedInToday(alice));
    }

    function testFuzz_StreakEqualsConsecutiveRunLength(uint8 run, uint8 gap) public {
        run = uint8(bound(run, 1, 30));
        gap = uint8(bound(gap, 2, 10)); // >= 2 days of silence breaks the streak

        vm.prank(alice);
        streak.checkIn("");
        _warpDays(gap);

        for (uint256 i = 0; i < run; i++) {
            vm.prank(alice);
            streak.checkIn("");
            if (i + 1 < run) _warpDays(1);
        }

        (,, uint32 s,, uint32 total) = streak.members(alice);
        assertEq(s, run);
        assertEq(total, uint32(run) + 1);
    }
}
