// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Streak} from "../src/Streak.sol";

contract StreakTest is Test {
    Streak internal streak;
    address internal alice = address(0xA11CE);

    event CheckedIn(address indexed member, uint32 indexed dayIndex, string note);

    function setUp() public {
        streak = new Streak();
        vm.warp(1_750_000_000); // some time in 2025
    }

    function test_EmitsCheckedIn() public {
        uint32 today = streak.currentDayIndex();
        vm.expectEmit(true, true, false, true);
        emit CheckedIn(alice, today, "gm");
        vm.prank(alice);
        streak.checkIn("gm");
    }

    function test_SecondCheckInSameDayReverts() public {
        vm.startPrank(alice);
        streak.checkIn("gm");
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedInToday.selector, streak.currentDayIndex()));
        streak.checkIn("gm again");
        vm.stopPrank();
    }

    function test_NextDayIsAllowed() public {
        vm.prank(alice);
        streak.checkIn("gm");
        vm.warp(block.timestamp + 1 days);
        assertTrue(streak.canCheckIn(alice));
        vm.prank(alice);
        streak.checkIn("gm again");
        assertEq(streak.lastDayPlusOne(alice), uint256(streak.currentDayIndex()) + 1);
    }

    function test_DayBoundaryIsUtcMidnight() public {
        // Not a literal expression: Solidity folds literal division exactly, so
        // `1_750_000_000 / 1 days * 1 days` would not truncate.
        uint256 someTime = 1_750_000_000;
        vm.warp(someTime / 1 days * 1 days); // exactly UTC midnight
        vm.prank(alice);
        streak.checkIn("");
        vm.warp(block.timestamp + 1 days - 1); // 23:59:59 the same UTC day
        assertFalse(streak.canCheckIn(alice));
        vm.warp(block.timestamp + 1); // next UTC midnight
        assertTrue(streak.canCheckIn(alice));
    }

    function test_LongNoteReverts() public {
        string memory tooLong = new string(141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Streak.NoteTooLong.selector, 141));
        streak.checkIn(tooLong);
    }

    function test_EmptyNoteIsFine() public {
        vm.prank(alice);
        streak.checkIn("");
    }
}
