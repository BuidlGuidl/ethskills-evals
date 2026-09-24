// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    event CheckedIn(
        address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note
    );
    event MemberJoined(address indexed member, uint32 indexed day);

    function setUp() public {
        streak = new Streak();
        // Start somewhere well past the epoch and exactly on a day boundary.
        vm.warp(1_700_000_000 - (1_700_000_000 % 1 days));
    }

    function _day() internal view returns (uint32) {
        return uint32(block.timestamp / 1 days);
    }

    function _skipDays(uint256 n) internal {
        vm.warp(block.timestamp + n * 1 days);
    }

    function test_FirstCheckInStartsStreakAtOne() public {
        vm.expectEmit(true, true, true, true);
        emit MemberJoined(alice, _day());
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, _day(), 1, 1, "gm");

        vm.prank(alice);
        streak.checkIn("gm");

        (uint32 lastDay, uint32 s, uint32 longest, uint32 total) = streak.memberStats(alice);
        assertEq(lastDay, _day());
        assertEq(s, 1);
        assertEq(longest, 1);
        assertEq(total, 1);
        assertEq(streak.totalCheckIns(), 1);
        assertEq(streak.totalMembers(), 1);
    }

    function test_RevertsOnSecondCheckInSameDay() public {
        vm.prank(alice);
        streak.checkIn("");

        // Later the same UTC day.
        vm.warp(block.timestamp + 6 hours);
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, _day()));
        vm.prank(alice);
        streak.checkIn("again");
    }

    function test_ConsecutiveDaysBuildStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn("gm");
            _skipDays(1);
        }
        (, uint32 s, uint32 longest, uint32 total) = streak.memberStats(alice);
        assertEq(s, 5);
        assertEq(longest, 5);
        assertEq(total, 5);
    }

    function test_MissedDayResetsStreakButKeepsTotalAndLongest() public {
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _skipDays(1);
        }
        _skipDays(2); // miss two days

        vm.prank(alice);
        streak.checkIn("back");

        (, uint32 s, uint32 longest, uint32 total) = streak.memberStats(alice);
        assertEq(s, 1, "streak restarts");
        assertEq(longest, 3, "longest preserved");
        assertEq(total, 4, "total keeps counting");
        assertEq(streak.totalMembers(), 1, "still one member");
    }

    function test_CheckInJustBeforeAndAfterMidnightIsAStreak() public {
        // 23:59 on day N
        vm.warp(block.timestamp + 1 days - 60);
        vm.prank(alice);
        streak.checkIn("late");

        // 00:01 on day N+1 — two minutes later, but a new day.
        vm.warp(block.timestamp + 120);
        vm.prank(alice);
        streak.checkIn("early");

        (, uint32 s,, uint32 total) = streak.memberStats(alice);
        assertEq(s, 2);
        assertEq(total, 2);
    }

    function test_CurrentStreakGoesStaleAfterAMissedDay() public {
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.currentStreak(alice), 1, "alive today");

        _skipDays(1);
        assertEq(streak.currentStreak(alice), 1, "still alive: yesterday");

        _skipDays(1);
        assertEq(streak.currentStreak(alice), 0, "broken: day missed");

        // Stored streak is untouched; only the live view reflects the break.
        (, uint32 stored,,) = streak.memberStats(alice);
        assertEq(stored, 1);
    }

    function test_CurrentStreakIsZeroForUnknownMember() public view {
        assertEq(streak.currentStreak(bob), 0);
    }

    function test_CanCheckIn() public {
        assertTrue(streak.canCheckIn(alice));
        vm.prank(alice);
        streak.checkIn("");
        assertFalse(streak.canCheckIn(alice));
        _skipDays(1);
        assertTrue(streak.canCheckIn(alice));
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("a");
        vm.prank(bob);
        streak.checkIn("b");
        _skipDays(1);
        vm.prank(alice);
        streak.checkIn("a2");

        (, uint32 sa,, uint32 ta) = streak.memberStats(alice);
        (, uint32 sb,, uint32 tb) = streak.memberStats(bob);
        assertEq(sa, 2);
        assertEq(ta, 2);
        assertEq(sb, 1);
        assertEq(tb, 1);
        assertEq(streak.totalCheckIns(), 3);
        assertEq(streak.totalMembers(), 2);
    }

    function test_RevertsOnOversizedNote() public {
        string memory long = new string(141);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141, 140));
        vm.prank(alice);
        streak.checkIn(long);
    }

    function test_AcceptsNoteAtExactlyMaxLength() public {
        string memory atMax = new string(140);
        vm.prank(alice);
        streak.checkIn(atMax);
        (,,, uint32 total) = streak.memberStats(alice);
        assertEq(total, 1);
    }

    function testFuzz_StreakEqualsRunOfConsecutiveDays(uint8 runLength, uint8 gap) public {
        runLength = uint8(bound(runLength, 1, 60));
        gap = uint8(bound(gap, 2, 30)); // >= 2 days later means a break

        vm.prank(alice);
        streak.checkIn("");
        _skipDays(gap);

        for (uint256 i = 0; i < runLength; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _skipDays(1);
        }

        (, uint32 s,, uint32 total) = streak.memberStats(alice);
        assertEq(s, runLength);
        assertEq(total, uint32(runLength) + 1);
    }
}
