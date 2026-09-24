// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;
    address internal alice = address(0xA11CE);

    uint256 internal constant DAY = 86_400;

    function setUp() public {
        // Start at a clean UTC day boundary well past the unix epoch.
        vm.warp(1_700_000_000 / DAY * DAY);
        streak = new Streak();
    }

    function _nextDay(uint256 n) internal {
        vm.warp(block.timestamp + n * DAY);
    }

    function test_FirstCheckInStartsStreakAtOne() public {
        vm.prank(alice);
        streak.checkIn("gm");

        (uint32 lastDay, uint32 s, uint32 total) = streak.members(alice);
        assertEq(lastDay, streak.currentDay());
        assertEq(s, 1);
        assertEq(total, 1);
        assertEq(streak.totalMembers(), 1);
        assertEq(streak.totalCheckIns(), 1);
    }

    function test_EmitsCheckedInWithDerivedState() public {
        uint32 today = streak.currentDay();
        vm.expectEmit(true, true, true, true);
        emit Streak.CheckedIn(alice, today, 1, 1, true, "shipped the docs");
        vm.prank(alice);
        streak.checkIn("shipped the docs");
    }

    function test_SecondCheckInSameDayReverts() public {
        vm.startPrank(alice);
        streak.checkIn();
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, streak.currentDay()));
        streak.checkIn();
        vm.stopPrank();
    }

    function test_ConsecutiveDaysIncrementStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn();
            _nextDay(1);
        }
        (, uint32 s, uint32 total) = streak.members(alice);
        assertEq(s, 5);
        assertEq(total, 5);
    }

    function test_MissedDayResetsStreak() public {
        vm.prank(alice);
        streak.checkIn();
        _nextDay(3);
        vm.prank(alice);
        streak.checkIn();

        (, uint32 s, uint32 total) = streak.members(alice);
        assertEq(s, 1);
        assertEq(total, 2);
    }

    function test_CurrentStreakDecaysAfterMissedDay() public {
        vm.prank(alice);
        streak.checkIn();
        assertEq(streak.currentStreak(alice), 1);

        // Still alive the next day: the member can extend it today.
        _nextDay(1);
        assertEq(streak.currentStreak(alice), 1);

        // Two days later the streak is broken.
        _nextDay(1);
        assertEq(streak.currentStreak(alice), 0);
    }

    function test_NoteTooLongReverts() public {
        string memory long = new string(141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141));
        streak.checkIn(long);
    }

    function test_HasCheckedInToday() public {
        assertFalse(streak.hasCheckedInToday(alice));
        vm.prank(alice);
        streak.checkIn();
        assertTrue(streak.hasCheckedInToday(alice));
        _nextDay(1);
        assertFalse(streak.hasCheckedInToday(alice));
    }
}
