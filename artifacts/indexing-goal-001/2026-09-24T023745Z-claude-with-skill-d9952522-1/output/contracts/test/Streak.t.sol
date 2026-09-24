// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint64 timestamp,
        uint32 currentStreak,
        uint32 totalCheckIns,
        string note
    );
    event MemberJoined(address indexed member, uint32 indexed day, uint64 timestamp);
    event StreakRecord(address indexed member, uint32 indexed day, uint32 length);

    function setUp() public {
        // A plausible "months of history already" starting point.
        vm.warp(1_750_000_000);
        streak = new Streak(0);
    }

    function _nextDay() internal {
        vm.warp(block.timestamp + 1 days);
    }

    function test_FirstCheckInStartsStreakAndEmitsJoin() public {
        uint32 day = streak.currentDay();

        vm.expectEmit(true, true, true, true);
        emit MemberJoined(alice, day, uint64(block.timestamp));
        vm.expectEmit(true, true, true, true);
        emit StreakRecord(alice, day, 1);
        vm.expectEmit(true, true, true, true);
        emit CheckedIn(alice, day, uint64(block.timestamp), 1, 1, "gm");

        vm.prank(alice);
        (uint32 gotDay, uint32 gotStreak) = streak.checkIn("gm");

        assertEq(gotDay, day);
        assertEq(gotStreak, 1);
        assertEq(streak.totalCheckIns(), 1);
        assertEq(streak.totalMembers(), 1);
        assertEq(streak.firstCheckInAt(), uint64(block.timestamp));
    }

    function test_SecondCheckInSameDayReverts() public {
        vm.prank(alice);
        streak.checkIn("");

        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, streak.currentDay()));
        vm.prank(alice);
        streak.checkIn("again");
    }

    function test_SameDayIsNotTwentyFourHours() public {
        // 23:00 then 01:00 the next morning are different days, only 2 hours apart.
        vm.warp((block.timestamp / 1 days) * 1 days + 23 hours);
        vm.prank(alice);
        streak.checkIn("late");

        vm.warp(block.timestamp + 2 hours);
        vm.prank(alice);
        (, uint32 s) = streak.checkIn("early");
        assertEq(s, 2, "consecutive calendar days continue the streak");
    }

    function test_ConsecutiveDaysGrowStreak() public {
        for (uint32 i = 1; i <= 5; i++) {
            vm.prank(alice);
            (, uint32 s) = streak.checkIn("gm");
            assertEq(s, i);
            _nextDay();
        }
        (, uint32 current,, uint32 total) = streak.members(alice);
        assertEq(current, 5);
        assertEq(total, 5);
    }

    function test_MissedDayResetsStreakButKeepsTotalAndRecord() public {
        for (uint32 i = 0; i < 3; i++) {
            vm.prank(alice);
            streak.checkIn("");
            _nextDay();
        }
        _nextDay(); // skip a full day

        vm.prank(alice);
        (, uint32 s) = streak.checkIn("back");
        assertEq(s, 1, "streak restarts");

        (, uint32 current, uint32 longest, uint32 total) = streak.members(alice);
        assertEq(current, 1);
        assertEq(longest, 3, "personal best survives the break");
        assertEq(total, 4, "all-time total keeps counting");
    }

    function test_LiveStreakDecaysWithoutAWrite() public {
        vm.prank(alice);
        streak.checkIn("");
        assertEq(streak.liveStreak(alice), 1);

        _nextDay();
        assertEq(streak.liveStreak(alice), 1, "yesterday's check-in is still alive today");

        _nextDay();
        assertEq(streak.liveStreak(alice), 0, "a missed day breaks it with no transaction");

        assertEq(streak.liveStreak(bob), 0, "never checked in");
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
        (, uint32 s) = streak.checkIn("a2");
        assertEq(s, 2);
        assertEq(streak.liveStreak(bob), 1, "bob is unaffected");
    }

    function test_NoteTooLongReverts() public {
        string memory note = new string(141);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141));
        vm.prank(alice);
        streak.checkIn(note);
    }

    function test_NoteAtMaxLengthIsAccepted() public {
        string memory note = new string(140);
        vm.prank(alice);
        streak.checkIn(note);
        assertEq(streak.totalCheckIns(), 1);
    }

    function test_DayOffsetShiftsTheBoundary() public {
        // -5h: the day rolls over at 05:00 UTC.
        Streak est = new Streak(-5 hours);
        uint256 midnightUtc = (block.timestamp / 1 days) * 1 days;

        vm.warp(midnightUtc + 3 hours);
        uint32 beforeRollover = est.currentDay();
        vm.warp(midnightUtc + 6 hours);
        assertEq(est.currentDay(), beforeRollover + 1, "boundary moved to 05:00 UTC");

        vm.warp(midnightUtc + 3 hours);
        assertEq(streak.currentDay(), est.currentDay() + 1, "UTC contract is a day ahead at 03:00");
    }

    /// @dev The read side replays events, so the post-state in the event must equal
    ///      the contract's own state for every check-in in a long random history.
    function testFuzz_EventStateMatchesStorage(uint8[24] calldata gaps) public {
        uint32 expectedStreak = 0;
        uint32 expectedTotal = 0;
        uint32 lastDay = 0;

        for (uint256 i = 0; i < gaps.length; i++) {
            uint256 gap = uint256(gaps[i]) % 4; // 0..3 days between attempts
            vm.warp(block.timestamp + (gap + 1) * 1 days);

            uint32 day = streak.currentDay();
            expectedStreak = (lastDay != 0 && lastDay + 1 == day) ? expectedStreak + 1 : 1;
            expectedTotal += 1;
            lastDay = day;

            vm.expectEmit(true, true, true, true);
            emit CheckedIn(alice, day, uint64(block.timestamp), expectedStreak, expectedTotal, "");

            vm.prank(alice);
            streak.checkIn("");

            (uint32 sLastDay, uint32 sStreak,, uint32 sTotal) = streak.members(alice);
            assertEq(sLastDay, day);
            assertEq(sStreak, expectedStreak);
            assertEq(sTotal, expectedTotal);
        }
    }
}
