// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        streak = new Streak();
        // Start at a deterministic UTC midnight.
        vm.warp(1_735_689_600); // 2025-01-01T00:00:00Z
    }

    function _day() internal view returns (uint32) {
        return streak.currentDay();
    }

    function test_firstCheckInStartsStreakAtOne() public {
        vm.prank(alice);
        streak.checkIn("gm");

        (uint32 cur, uint32 longest, uint32 total,, uint32 lastDay, bool today) = streak.profileOf(alice);
        assertEq(cur, 1);
        assertEq(longest, 1);
        assertEq(total, 1);
        assertEq(lastDay, _day());
        assertTrue(today);
        assertEq(streak.totalMembers(), 1);
        assertEq(streak.totalCheckIns(), 1);
    }

    function test_emitsEventWithReadSideFields() public {
        vm.expectEmit(true, true, false, true);
        emit Streak.CheckedIn(alice, _day(), 1, 1, true, "shipped the docs");
        vm.prank(alice);
        streak.checkIn("shipped the docs");
    }

    function test_revertsOnSecondCheckInSameDay() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, _day()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_consecutiveDaysIncrementStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn("gm");
            vm.warp(block.timestamp + 1 days);
        }
        // Mid-day on day 6, yesterday's streak of 5 is still alive.
        (uint32 cur, uint32 longest, uint32 total,,,) = streak.profileOf(alice);
        assertEq(cur, 5);
        assertEq(longest, 5);
        assertEq(total, 5);
    }

    function test_gapBreaksStreakButKeepsLongestAndTotal() public {
        vm.prank(alice);
        streak.checkIn("day 1");
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        streak.checkIn("day 2");

        // Skip a day entirely.
        vm.warp(block.timestamp + 3 days);
        (uint32 cur, uint32 longest, uint32 total,,,) = streak.profileOf(alice);
        assertEq(cur, 0, "stale streak reads as broken without any write");
        assertEq(longest, 2);
        assertEq(total, 2);

        vm.prank(alice);
        streak.checkIn("back");
        (cur, longest, total,,,) = streak.profileOf(alice);
        assertEq(cur, 1);
        assertEq(longest, 2);
        assertEq(total, 3);
    }

    function test_streaksAreIndependentPerMember() public {
        vm.prank(alice);
        streak.checkIn("a");
        vm.prank(bob);
        streak.checkIn("b");
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        streak.checkIn("a");

        (uint32 aliceStreak,,,,,) = streak.profileOf(alice);
        (uint32 bobStreak,,,,,) = streak.profileOf(bob);
        assertEq(aliceStreak, 2);
        assertEq(bobStreak, 1);
        assertEq(streak.totalMembers(), 2);
        assertEq(streak.totalCheckIns(), 3);
    }

    function test_emptyNoteAllowed() public {
        vm.prank(alice);
        streak.checkIn("");
        (,, uint32 total,,,) = streak.profileOf(alice);
        assertEq(total, 1);
    }

    function test_revertsOnOversizedNote() public {
        string memory long = new string(141);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141, 140));
        vm.prank(alice);
        streak.checkIn(long);
    }

    function test_hasCheckedInToday() public {
        assertFalse(streak.hasCheckedInToday(alice));
        vm.prank(alice);
        streak.checkIn("gm");
        assertTrue(streak.hasCheckedInToday(alice));
        vm.warp(block.timestamp + 1 days);
        assertFalse(streak.hasCheckedInToday(alice));
    }
}
