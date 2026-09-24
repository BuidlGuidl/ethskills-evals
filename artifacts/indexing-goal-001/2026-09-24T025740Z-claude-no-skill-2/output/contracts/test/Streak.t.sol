// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    event CheckedIn(
        address indexed member, uint32 indexed day, uint64 timestamp, uint32 streak, uint32 total, string note
    );

    function setUp() public {
        streak = new Streak();
        // Start somewhere in the middle of a UTC day so tests are not sensitive
        // to day boundaries.
        vm.warp(1_700_000_000);
    }

    function _warpDays(uint256 n) internal {
        vm.warp(block.timestamp + n * 1 days);
    }

    function test_FirstCheckInStartsStreak() public {
        vm.prank(alice);
        (uint32 day, uint32 s) = streak.checkIn("gm");

        assertEq(day, streak.currentDay());
        assertEq(s, 1);
        assertEq(streak.currentStreakOf(alice), 1);
        assertEq(streak.totalCheckIns(), 1);
        assertEq(streak.totalMembers(), 1);
        assertTrue(streak.hasCheckedInToday(alice));
    }

    function test_EmitsCheckedInEvent() public {
        uint32 day = streak.currentDay();
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, day, uint64(block.timestamp), 1, 1, "shipped the docs");
        vm.prank(alice);
        streak.checkIn("shipped the docs");
    }

    function test_ConsecutiveDaysIncrementStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            (, uint32 s) = streak.checkIn("gm");
            assertEq(s, uint32(i + 1));
            _warpDays(1);
        }
        // Streak from yesterday is still alive today.
        assertEq(streak.currentStreakOf(alice), 5);

        (uint32 current, uint32 longest, uint32 total,,) = streak.profileOf(alice);
        assertEq(current, 5);
        assertEq(longest, 5);
        assertEq(total, 5);
    }

    function test_RevertsOnSecondCheckInSameDay() public {
        vm.prank(alice);
        streak.checkIn("gm");

        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedIn.selector, alice, streak.currentDay()));
        vm.prank(alice);
        streak.checkIn("gm again");
    }

    function test_SameDayBoundaryIsUtcNotRolling() public {
        // Check in one second before the UTC day boundary...
        uint256 boundary = (block.timestamp / 1 days + 1) * 1 days;
        vm.warp(boundary - 1);
        vm.prank(alice);
        streak.checkIn("late");

        // ...then one second after: that is a new day, streak continues.
        vm.warp(boundary + 1);
        vm.prank(alice);
        (, uint32 s) = streak.checkIn("early");
        assertEq(s, 2);
    }

    function test_MissedDayBreaksStreak() public {
        vm.prank(alice);
        streak.checkIn("day 1");
        _warpDays(1);
        vm.prank(alice);
        streak.checkIn("day 2");

        // Skip a full day.
        _warpDays(2);
        assertEq(streak.currentStreakOf(alice), 0, "streak should be broken while idle");

        vm.prank(alice);
        (, uint32 s) = streak.checkIn("back");
        assertEq(s, 1);

        (uint32 current, uint32 longest, uint32 total,,) = streak.profileOf(alice);
        assertEq(current, 1);
        assertEq(longest, 2, "longest streak is remembered");
        assertEq(total, 3);
    }

    function test_StaleStreakIsNotReportedAsCurrent() public {
        vm.prank(alice);
        streak.checkIn("gm");
        _warpDays(1);
        vm.prank(alice);
        streak.checkIn("gm");

        _warpDays(1); // yesterday -> still alive
        assertEq(streak.currentStreakOf(alice), 2);
        _warpDays(1); // two days ago -> broken
        assertEq(streak.currentStreakOf(alice), 0);
        assertFalse(streak.hasCheckedInToday(alice));

        // Raw storage still holds the stale value, by design.
        assertEq(streak.memberOf(alice).streak, 2);
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("a1");
        vm.prank(bob);
        streak.checkIn("b1");
        _warpDays(1);
        vm.prank(alice);
        streak.checkIn("a2");
        _warpDays(2);
        vm.prank(bob);
        streak.checkIn("b2");

        assertEq(streak.currentStreakOf(alice), 0);
        assertEq(streak.currentStreakOf(bob), 1);
        assertEq(streak.totalCheckIns(), 4);
        assertEq(streak.totalMembers(), 2);
    }

    function test_EmptyNoteIsAllowed() public {
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.currentStreakOf(alice), 1);
    }

    function test_RevertsOnOversizedNote() public {
        string memory note = new string(141);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141));
        vm.prank(alice);
        streak.checkIn(note);
    }

    function test_MaxLengthNoteIsAllowed() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        assertEq(streak.memberOf(alice).total, 1);
    }

    function test_UnknownMemberHasEmptyProfile() public view {
        (uint32 current, uint32 longest, uint32 total, uint32 firstDay, uint32 lastDay) = streak.profileOf(bob);
        assertEq(current, 0);
        assertEq(longest, 0);
        assertEq(total, 0);
        assertEq(firstDay, 0);
        assertEq(lastDay, 0);
        assertFalse(streak.hasCheckedInToday(bob));
    }

    function testFuzz_StreakMatchesDayGaps(uint8[16] memory gaps) public {
        uint32 expected = 0;
        uint32 total = 0;
        uint32 lastDay = 0;

        for (uint256 i = 0; i < gaps.length; i++) {
            uint256 gap = uint256(gaps[i]) % 4; // 0..3 days since previous loop step
            _warpDays(gap);
            uint32 today = streak.currentDay();
            if (total != 0 && lastDay == today) continue; // same day, skip

            if (total == 0) {
                expected = 1;
            } else {
                expected = lastDay + 1 == today ? expected + 1 : 1;
            }

            vm.prank(alice);
            (, uint32 s) = streak.checkIn("gm");
            assertEq(s, expected);

            lastDay = today;
            total += 1;
        }

        assertEq(streak.memberOf(alice).total, total);
    }
}
