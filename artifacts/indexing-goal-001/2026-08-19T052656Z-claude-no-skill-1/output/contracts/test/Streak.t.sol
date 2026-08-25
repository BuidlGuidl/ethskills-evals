// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    event CheckedIn(address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note);

    function setUp() public {
        streak = new Streak();
        // Start at a deterministic, non-zero UTC day boundary.
        vm.warp(1_767_225_600); // 2026-01-01T00:00:00Z
    }

    function _warpDays(uint256 n) internal {
        vm.warp(block.timestamp + n * 1 days);
    }

    function test_FirstCheckInStartsStreakAndRegistersMember() public {
        vm.prank(alice);
        streak.checkIn("gm");

        Streak.Member memory m = streak.memberOf(alice);
        assertEq(m.firstDay, streak.today());
        assertEq(m.lastDay, streak.today());
        assertEq(m.streak, 1);
        assertEq(m.longestStreak, 1);
        assertEq(m.totalCheckIns, 1);
        assertEq(streak.totalMembers(), 1);
        assertEq(streak.totalCheckIns(), 1);
        assertTrue(streak.hasCheckedInToday(alice));
    }

    function test_EmitsCheckedInWithNote() public {
        uint32 day = streak.today();
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, day, 1, 1, "shipped the docs");
        vm.prank(alice);
        streak.checkIn("shipped the docs");
    }

    function test_NoteIsOptional() public {
        vm.prank(alice);
        streak.checkIn();
        assertEq(streak.memberOf(alice).totalCheckIns, 1);
    }

    function test_RevertWhen_CheckingInTwiceInOneDay() public {
        vm.startPrank(alice);
        streak.checkIn("gm");

        // Later the same UTC day, but still the same day index.
        vm.warp(block.timestamp + 23 hours);
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, streak.today()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_ConsecutiveDaysExtendStreak() public {
        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            streak.checkIn("gm");
            _warpDays(1);
        }
        vm.stopPrank();

        Streak.Member memory m = streak.memberOf(alice);
        assertEq(m.streak, 5);
        assertEq(m.longestStreak, 5);
        assertEq(m.totalCheckIns, 5);
        // Yesterday's check-in still counts today.
        assertEq(streak.currentStreak(alice), 5);
    }

    function test_MissedDayResetsStreakButKeepsLongest() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        _warpDays(1);
        streak.checkIn("gm");
        _warpDays(1);
        streak.checkIn("gm");
        _warpDays(3); // skipped two full days
        streak.checkIn("back");
        vm.stopPrank();

        Streak.Member memory m = streak.memberOf(alice);
        assertEq(m.streak, 1);
        assertEq(m.longestStreak, 3);
        assertEq(m.totalCheckIns, 4);
    }

    function test_CurrentStreakDecaysAfterTwoDaysOfSilence() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        _warpDays(1);
        streak.checkIn("gm");
        vm.stopPrank();

        assertEq(streak.currentStreak(alice), 2); // same day
        _warpDays(1);
        assertEq(streak.currentStreak(alice), 2); // grace: checked in yesterday
        _warpDays(1);
        assertEq(streak.currentStreak(alice), 0); // streak is broken
        // The stored value is stale on purpose; it is only correct as of `lastDay`.
        assertEq(streak.memberOf(alice).streak, 2);
    }

    function test_CurrentStreakIsZeroForUnknownMember() public view {
        assertEq(streak.currentStreak(bob), 0);
        assertFalse(streak.hasCheckedInToday(bob));
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("gm");
        vm.prank(bob);
        streak.checkIn("hello");

        _warpDays(1);
        vm.prank(alice);
        streak.checkIn("gm");

        assertEq(streak.memberOf(alice).streak, 2);
        assertEq(streak.memberOf(bob).streak, 1);
        assertEq(streak.totalMembers(), 2);
        assertEq(streak.totalCheckIns(), 3);
    }

    function test_RevertWhen_NoteTooLong() public {
        string memory note = new string(141);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141, 140));
        vm.prank(alice);
        streak.checkIn(note);
    }

    function test_NoteAtMaxLengthIsAccepted() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        assertEq(streak.memberOf(alice).totalCheckIns, 1);
    }

    function testFuzz_StreakMatchesGapPattern(uint8 gap) public {
        gap = uint8(bound(gap, 1, 30));
        vm.startPrank(alice);
        streak.checkIn("gm");
        _warpDays(gap);
        streak.checkIn("gm");
        vm.stopPrank();

        assertEq(streak.memberOf(alice).streak, gap == 1 ? 2 : 1);
        assertEq(streak.memberOf(alice).totalCheckIns, 2);
    }
}
