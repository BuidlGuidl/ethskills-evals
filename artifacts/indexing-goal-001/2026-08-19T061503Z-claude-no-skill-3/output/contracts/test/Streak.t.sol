// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    // A plausible "already running for months" starting point, mid-day so that
    // day boundaries are exercised rather than sitting exactly on one.
    uint256 internal constant START = 1_767_225_600 + 12 hours; // 2026-01-01 12:00 UTC

    event CheckedIn(
        address indexed member, uint64 indexed day, uint64 timestamp, uint32 streak, uint64 total, string note
    );
    event MemberJoined(address indexed member, uint64 indexed day, uint64 timestamp);

    function setUp() public {
        vm.warp(START);
        streak = new Streak();
    }

    function _nextDay() internal {
        vm.warp(block.timestamp + 1 days);
    }

    function test_FirstCheckInEmitsJoinAndCheckIn() public {
        uint64 day = streak.today();

        vm.expectEmit(true, true, true, true);
        emit MemberJoined(alice, day, uint64(block.timestamp));
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, day, uint64(block.timestamp), 1, 1, "gm");

        vm.prank(alice);
        streak.checkIn("gm");

        (uint64 lastDay, uint32 s, uint32 longest, uint64 total) = streak.members(alice);
        assertEq(lastDay, day);
        assertEq(s, 1);
        assertEq(longest, 1);
        assertEq(total, 1);
        assertEq(streak.totalCheckIns(), 1);
        assertEq(streak.totalMembers(), 1);
    }

    function test_SecondCheckInSameDayReverts() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, streak.today()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_SameDayMeansUtcDayNotTwentyFourHours() public {
        // 12:00 UTC then 23:59 UTC on the same day: still the same day.
        vm.prank(alice);
        streak.checkIn("");
        vm.warp(block.timestamp + 11 hours + 59 minutes);
        vm.prank(alice);
        vm.expectRevert();
        streak.checkIn("");

        // 00:01 UTC the next day is a new day, only ~2 minutes later.
        vm.warp(block.timestamp + 2 minutes);
        vm.prank(alice);
        streak.checkIn("");
        (, uint32 s,,) = streak.members(alice);
        assertEq(s, 2);
    }

    function test_ConsecutiveDaysGrowStreak() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _nextDay();
        }
        (, uint32 s, uint32 longest, uint64 total) = streak.members(alice);
        assertEq(s, 5);
        assertEq(longest, 5);
        assertEq(total, 5);
    }

    function test_MissedDayResetsStreakAndKeepsLongest() public {
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _nextDay();
        }
        _nextDay(); // skip a day

        vm.prank(alice);
        streak.checkIn("back");

        (, uint32 s, uint32 longest, uint64 total) = streak.members(alice);
        assertEq(s, 1, "streak restarts");
        assertEq(longest, 3, "longest is remembered");
        assertEq(total, 4, "total is all-time");
    }

    function test_CurrentStreakDecaysAfterAMissedDay() public {
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.currentStreak(alice), 1, "today");

        _nextDay();
        assertEq(streak.currentStreak(alice), 1, "yesterday still counts");

        _nextDay();
        assertEq(streak.currentStreak(alice), 0, "two days ago is broken");

        // Storage still holds the streak as of the last check-in.
        (, uint32 s,,) = streak.members(alice);
        assertEq(s, 1);
    }

    function test_CanCheckIn() public {
        assertTrue(streak.canCheckIn(alice));
        vm.prank(alice);
        streak.checkIn("");
        assertFalse(streak.canCheckIn(alice));
        _nextDay();
        assertTrue(streak.canCheckIn(alice));
    }

    function test_MembersAreIndependent() public {
        vm.prank(alice);
        streak.checkIn("a");
        vm.prank(bob);
        streak.checkIn("b");
        assertEq(streak.totalMembers(), 2);
        assertEq(streak.totalCheckIns(), 2);

        _nextDay();
        vm.prank(alice);
        streak.checkIn("a2");

        (, uint32 as_,,) = streak.members(alice);
        (, uint32 bs,,) = streak.members(bob);
        assertEq(as_, 2);
        assertEq(bs, 1);
        assertEq(streak.totalMembers(), 2, "bob is not counted twice");
    }

    function test_NoteTooLongReverts() public {
        string memory note = new string(141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141, 140));
        streak.checkIn(note);
    }

    function test_NoteAtMaxLengthIsAccepted() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        (,,, uint64 total) = streak.members(alice);
        assertEq(total, 1);
    }

    function testFuzz_StreakMatchesGapPattern(uint8 gapDays) public {
        gapDays = uint8(bound(gapDays, 1, 30));

        vm.prank(alice);
        streak.checkIn("");
        vm.warp(block.timestamp + uint256(gapDays) * 1 days);
        vm.prank(alice);
        streak.checkIn("");

        (, uint32 s,,) = streak.members(alice);
        assertEq(s, gapDays == 1 ? 2 : 1);
    }
}
