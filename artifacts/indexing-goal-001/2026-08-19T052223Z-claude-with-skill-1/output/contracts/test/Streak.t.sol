// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant DAY = 1 days;

    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint32 indexed month,
        uint64 timestamp,
        uint32 streak,
        uint32 total,
        string note
    );
    event MemberJoined(address indexed member, uint64 timestamp);

    function setUp() public {
        streak = new Streak();
        // 2026-08-19 00:00:00 UTC
        vm.warp(1_787_097_600);
    }

    function _day() internal view returns (uint32) {
        return uint32(block.timestamp / DAY);
    }

    function test_FirstCheckInEmitsEverythingTheReadSideNeeds() public {
        vm.expectEmit(true, true, false, true);
        emit MemberJoined(alice, uint64(block.timestamp));
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, _day(), streak.currentMonth(), uint64(block.timestamp), 1, 1, "gm");

        vm.prank(alice);
        streak.checkIn("gm");

        (uint32 s, uint32 longest, uint32 total,,) = streak.profileOf(alice);
        assertEq(s, 1);
        assertEq(longest, 1);
        assertEq(total, 1);
        assertEq(streak.totalMembers(), 1);
        assertEq(streak.totalCheckIns(), 1);
    }

    function test_RevertsOnSecondCheckInSameDay() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, _day()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_AllowsCheckInJustAfterUtcMidnight() public {
        vm.warp(block.timestamp + 23 hours);
        vm.prank(alice);
        streak.checkIn("late");

        vm.warp(block.timestamp + 2 hours); // next UTC day, only 2h later
        vm.prank(alice);
        streak.checkIn("early");

        (, , uint32 total,,) = streak.profileOf(alice);
        assertEq(total, 2);
        assertEq(streak.currentStreak(alice), 2);
    }

    function test_StreakGrowsOnConsecutiveDays() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn("gm");
            vm.warp(block.timestamp + DAY);
        }
        assertEq(streak.currentStreak(alice), 5);
        (, uint32 longest, uint32 total,,) = streak.profileOf(alice);
        assertEq(longest, 5);
        assertEq(total, 5);
    }

    function test_StreakResetsAfterAMissedDay() public {
        vm.prank(alice);
        streak.checkIn("day 1");
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        streak.checkIn("day 2");

        vm.warp(block.timestamp + 2 * DAY); // skipped a day
        vm.prank(alice);
        streak.checkIn("back");

        assertEq(streak.currentStreak(alice), 1);
        (, uint32 longest, uint32 total,,) = streak.profileOf(alice);
        assertEq(longest, 2, "longest streak is kept");
        assertEq(total, 3);
    }

    /// @dev The stored streak is "as of the last check-in"; the live view has to
    ///      decay it. The indexer's API applies the same rule (see liveStreak).
    function test_LiveStreakDecaysWithoutAnyEvent() public {
        vm.prank(alice);
        streak.checkIn("gm");
        assertEq(streak.currentStreak(alice), 1);

        vm.warp(block.timestamp + DAY); // yesterday's check-in still counts
        assertEq(streak.currentStreak(alice), 1);

        vm.warp(block.timestamp + DAY); // a full day missed
        assertEq(streak.currentStreak(alice), 0);

        (,, uint32 total,,) = streak.profileOf(alice);
        assertEq(total, 1, "total is unaffected");
    }

    function test_RevertsOnOversizedNote() public {
        string memory tooLong = new string(141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141, 140));
        streak.checkIn(tooLong);
    }

    function test_EmptyNoteIsAllowed() public {
        vm.prank(alice);
        streak.checkIn("");
        (,, uint32 total,,) = streak.profileOf(alice);
        assertEq(total, 1);
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("a");
        vm.prank(bob);
        streak.checkIn("b");
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        streak.checkIn("a2");

        assertEq(streak.currentStreak(alice), 2);
        assertEq(streak.currentStreak(bob), 1);
        assertEq(streak.totalMembers(), 2);
        assertEq(streak.totalCheckIns(), 3);
        assertTrue(streak.canCheckIn(bob));
        assertFalse(streak.canCheckIn(alice));
    }

    function test_MonthKeyMatchesUtcCalendar() public {
        vm.warp(1_787_097_600); // 2026-08-19T00:00:00Z
        assertEq(streak.currentMonth(), 202608);
        vm.warp(1_767_225_600); // 2026-01-01T00:00:00Z
        assertEq(streak.currentMonth(), 202601);
        vm.warp(1_767_225_599); // 2025-12-31T23:59:59Z
        assertEq(streak.currentMonth(), 202512);
        vm.warp(1_709_164_800); // 2024-02-29T00:00:00Z (leap day)
        assertEq(streak.currentMonth(), 202402);
    }

    function testFuzz_MonthKeyIsWellFormed(uint40 timestamp) public {
        vm.assume(timestamp > 1_600_000_000);
        vm.warp(timestamp);
        uint32 m = streak.currentMonth();
        assertGe(m % 100, 1);
        assertLe(m % 100, 12);
        assertGe(m / 100, 2020);
    }
}
