// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    // An arbitrary mid-day timestamp so day boundaries are not aligned to the
    // start of the test.
    uint256 internal constant T0 = 1_750_000_000;

    function setUp() public {
        vm.warp(T0);
        streak = new Streak();
    }

    function _day(uint256 ts) internal pure returns (uint32) {
        return uint32(ts / 1 days);
    }

    function test_FirstCheckInStartsStreak() public {
        vm.prank(alice);
        streak.checkIn("gm");

        (uint32 lastDay, uint32 current, uint32 longest, uint32 total) = streak.recordOf(alice);
        assertEq(lastDay, _day(T0));
        assertEq(current, 1);
        assertEq(longest, 1);
        assertEq(total, 1);
        assertEq(streak.totalCheckIns(), 1);
        assertEq(streak.totalMembers(), 1);
        assertTrue(streak.hasCheckedInToday(alice));
    }

    function test_EmitsCheckedIn() public {
        vm.expectEmit(true, true, false, true, address(streak));
        emit Streak.CheckedIn(alice, _day(T0), uint64(T0), 1, 1, "shipped the docs");
        vm.prank(alice);
        streak.checkIn("shipped the docs");
    }

    function test_SecondCheckInSameDayReverts() public {
        vm.startPrank(alice);
        streak.checkIn("");
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, _day(T0)));
        streak.checkIn("");
        vm.stopPrank();
    }

    function test_SameDayRevertsEvenLaterInTheDay() public {
        // Warp to the very start of a UTC day, then to one second before the next.
        uint256 dayStart = (T0 / 1 days) * 1 days;
        vm.warp(dayStart);
        vm.prank(alice);
        streak.checkIn("early");

        vm.warp(dayStart + 1 days - 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, _day(dayStart)));
        streak.checkIn("late");
    }

    function test_ConsecutiveDaysGrowStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(T0 + i * 1 days);
            vm.prank(alice);
            streak.checkIn("");
        }
        (, uint32 current, uint32 longest, uint32 total) = streak.recordOf(alice);
        assertEq(current, 5);
        assertEq(longest, 5);
        assertEq(total, 5);
        assertEq(streak.liveStreak(alice), 5);
    }

    function test_GapResetsStreakButKeepsLongestAndTotal() public {
        for (uint256 i = 0; i < 3; i++) {
            vm.warp(T0 + i * 1 days);
            vm.prank(alice);
            streak.checkIn("");
        }
        // Skip a day.
        vm.warp(T0 + 4 days);
        vm.prank(alice);
        streak.checkIn("");

        (, uint32 current, uint32 longest, uint32 total) = streak.recordOf(alice);
        assertEq(current, 1);
        assertEq(longest, 3);
        assertEq(total, 4);
    }

    function test_LiveStreakSurvivesTodayAndYesterdayThenDrops() public {
        vm.warp(T0);
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.liveStreak(alice), 1, "same day");

        vm.warp(T0 + 1 days);
        assertEq(streak.liveStreak(alice), 1, "next day, still claimable");

        vm.warp(T0 + 2 days);
        assertEq(streak.liveStreak(alice), 0, "day missed");

        // The stored value is untouched; only the live view decays.
        (, uint32 current,,) = streak.recordOf(alice);
        assertEq(current, 1);
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("gm");
        vm.prank(bob);
        streak.checkIn("gm");

        vm.warp(T0 + 1 days);
        vm.prank(alice);
        streak.checkIn("gm again");

        (, uint32 aliceStreak,, uint32 aliceTotal) = streak.recordOf(alice);
        (, uint32 bobStreak,, uint32 bobTotal) = streak.recordOf(bob);
        assertEq(aliceStreak, 2);
        assertEq(aliceTotal, 2);
        assertEq(bobStreak, 1);
        assertEq(bobTotal, 1);
        assertEq(streak.totalMembers(), 2);
        assertEq(streak.totalCheckIns(), 3);
    }

    function test_NoteAtLimitIsAllowed() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        (,,, uint32 total) = streak.recordOf(alice);
        assertEq(total, 1);
    }

    function test_TooLongNoteReverts() public {
        string memory note = new string(141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141));
        streak.checkIn(note);
    }

    function test_UnknownMemberReadsAreZero() public view {
        (uint32 lastDay, uint32 current, uint32 longest, uint32 total) = streak.recordOf(bob);
        assertEq(lastDay, 0);
        assertEq(current, 0);
        assertEq(longest, 0);
        assertEq(total, 0);
        assertEq(streak.liveStreak(bob), 0);
        assertFalse(streak.hasCheckedInToday(bob));
    }
}
