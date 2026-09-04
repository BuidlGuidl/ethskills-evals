// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint32 streak,
        uint32 memberTotal,
        string note
    );

    function setUp() public {
        streak = new Streak();
        // Start at a deterministic, non-zero UTC day.
        vm.warp(1_767_225_600); // 2026-01-01T00:00:00Z
    }

    function _nextDay() internal {
        vm.warp(block.timestamp + 1 days);
    }

    function test_FirstCheckInStartsStreakAtOne() public {
        vm.prank(alice);
        streak.checkIn("gm");

        (uint32 s, uint32 total, uint32 lastDay) = streak.getMember(alice);
        assertEq(s, 1);
        assertEq(total, 1);
        assertEq(lastDay, streak.today());
        assertEq(streak.memberCount(), 1);
        assertEq(streak.totalCheckIns(), 1);
    }

    function test_EmitsEventWithEverythingTheReadSideNeeds() public {
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, streak.today(), 1, 1, "shipped the docs");
        vm.prank(alice);
        streak.checkIn("shipped the docs");
    }

    function test_SecondCheckInSameDayReverts() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        vm.expectRevert(
            abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, streak.today())
        );
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_ConsecutiveDaysGrowStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _nextDay();
        }
        (uint32 s, uint32 total,) = streak.getMember(alice);
        assertEq(s, 5);
        assertEq(total, 5);
    }

    function test_MissedDayResetsStreakOnNextCheckIn() public {
        vm.prank(alice);
        streak.checkIn("");
        _nextDay();
        vm.prank(alice);
        streak.checkIn("");
        _nextDay();
        _nextDay(); // missed a day

        vm.prank(alice);
        streak.checkIn("");
        (uint32 s, uint32 total,) = streak.getMember(alice);
        assertEq(s, 1);
        assertEq(total, 3);
    }

    function test_CurrentStreakSurvivesUntilEndOfNextDayThenDropsToZero() public {
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.currentStreak(alice), 1);

        _nextDay(); // yesterday's check-in, still alive
        assertEq(streak.currentStreak(alice), 1);

        _nextDay(); // day missed, streak is dead
        assertEq(streak.currentStreak(alice), 0);
        (, uint32 total,) = streak.getMember(alice);
        assertEq(total, 1, "total is all-time and never resets");
    }

    function test_CanCheckIn() public {
        assertTrue(streak.canCheckIn(alice));
        vm.prank(alice);
        streak.checkIn("");
        assertFalse(streak.canCheckIn(alice));
        _nextDay();
        assertTrue(streak.canCheckIn(alice));
    }

    function test_NoteTooLongReverts() public {
        string memory long = new string(141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141));
        streak.checkIn(long);
    }

    function test_MaxLengthNoteAccepted() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        (, uint32 total,) = streak.getMember(alice);
        assertEq(total, 1);
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("gm");
        vm.prank(bob);
        streak.checkIn("gm");
        _nextDay();
        vm.prank(alice);
        streak.checkIn("gm");

        assertEq(streak.currentStreak(alice), 2);
        assertEq(streak.currentStreak(bob), 1);
        assertEq(streak.memberCount(), 2);
        assertEq(streak.totalCheckIns(), 3);
    }

    function testFuzz_TotalsTrackCheckIns(uint8 days_) public {
        vm.assume(days_ > 0 && days_ < 60);
        for (uint256 i = 0; i < days_; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _nextDay();
        }
        (uint32 s, uint32 total,) = streak.getMember(alice);
        assertEq(total, days_);
        assertEq(s, days_);
    }
}
