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
        // Start somewhere in the middle of a day so day boundaries are exercised.
        vm.warp(1_700_000_000);
        streak = new Streak();
    }

    function _warpDays(uint256 n) internal {
        vm.warp(vm.getBlockTimestamp() + n * 1 days);
    }

    function test_FirstCheckInSetsStreakAndTotal() public {
        vm.prank(alice);
        streak.checkIn("gm");

        Streak.Member memory m = streak.memberOf(alice);
        assertEq(m.streak, 1);
        assertEq(m.total, 1);
        assertEq(m.longestStreak, 1);
        assertEq(m.firstDay, streak.today());
        assertEq(streak.totalCheckIns(), 1);
        assertEq(streak.totalMembers(), 1);
    }

    function test_EmitsCheckedIn() public {
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, streak.today(), 1, 1, "shipped the docs");
        vm.prank(alice);
        streak.checkIn("shipped the docs");
    }

    function test_SecondCheckInSameDayReverts() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, streak.today()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_CheckInAllowedAfterUtcMidnight() public {
        vm.prank(alice);
        streak.checkIn("");

        // One second before midnight: still blocked.
        vm.warp((uint256(streak.today()) + 1) * 1 days - 1);
        assertFalse(streak.canCheckIn(alice));
        assertEq(streak.secondsUntilNextCheckIn(alice), 1);

        vm.warp(vm.getBlockTimestamp() + 1);
        assertTrue(streak.canCheckIn(alice));
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.memberOf(alice).streak, 2);
    }

    function test_ConsecutiveDaysGrowStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _warpDays(1);
        }
        Streak.Member memory m = streak.memberOf(alice);
        assertEq(m.streak, 5);
        assertEq(m.total, 5);
        assertEq(m.longestStreak, 5);
    }

    function test_MissedDayResetsStreakButKeepsTotalAndLongest() public {
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _warpDays(1);
        }
        _warpDays(2); // miss two days

        vm.prank(alice);
        streak.checkIn("back");

        Streak.Member memory m = streak.memberOf(alice);
        assertEq(m.streak, 1);
        assertEq(m.total, 4);
        assertEq(m.longestStreak, 3);
    }

    function test_CurrentStreakDecaysWithoutNewCheckIn() public {
        vm.startPrank(alice);
        streak.checkIn("");
        _warpDays(1);
        streak.checkIn("");
        vm.stopPrank();

        assertEq(streak.currentStreak(alice), 2); // checked in today
        _warpDays(1);
        assertEq(streak.currentStreak(alice), 2); // yesterday: still alive, today pending
        _warpDays(1);
        assertEq(streak.currentStreak(alice), 0); // missed a full day: over
        assertEq(streak.memberOf(alice).streak, 2); // stored value is the streak *at* lastDay
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("a");
        vm.prank(bob);
        streak.checkIn("b");
        _warpDays(1);
        vm.prank(alice);
        streak.checkIn("a2");

        assertEq(streak.memberOf(alice).streak, 2);
        assertEq(streak.memberOf(bob).streak, 1);
        assertEq(streak.totalCheckIns(), 3);
        assertEq(streak.totalMembers(), 2);
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

    function test_UncheckedMemberReadsAreZero() public view {
        assertEq(streak.currentStreak(bob), 0);
        assertEq(streak.totalOf(bob), 0);
        assertTrue(streak.canCheckIn(bob));
        assertEq(streak.secondsUntilNextCheckIn(bob), 0);
    }

    function testFuzz_StreakEqualsConsecutiveRun(uint8 runLength, uint8 gapDays) public {
        runLength = uint8(bound(runLength, 1, 40));
        gapDays = uint8(bound(gapDays, 2, 10)); // >= 2 means the streak breaks

        vm.prank(alice);
        streak.checkIn("");
        _warpDays(gapDays);

        for (uint256 i = 0; i < runLength; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _warpDays(1);
        }

        Streak.Member memory m = streak.memberOf(alice);
        assertEq(m.streak, runLength);
        assertEq(m.total, uint32(runLength) + 1);
    }
}
