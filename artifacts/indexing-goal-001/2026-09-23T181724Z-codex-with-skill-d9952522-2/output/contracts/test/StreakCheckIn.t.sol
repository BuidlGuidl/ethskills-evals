// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {StreakCheckIn} from "../StreakCheckIn.sol";

contract StreakCheckInTest is Test {
    StreakCheckIn private streak;
    address private member = address(0xA11CE);

    event CheckedIn(address indexed member, uint64 indexed day, uint64 timestamp, string note);

    function setUp() external {
        streak = new StreakCheckIn();
    }

    function testCheckInEmitsIndexerFriendlyEvent() external {
        vm.warp(1_735_776_000);
        uint64 day = uint64(block.timestamp / 1 days);

        vm.expectEmit(true, true, true, true);
        emit CheckedIn(member, day, uint64(block.timestamp), "gm");

        vm.prank(member);
        streak.checkIn("gm");

        assertEq(streak.lastCheckInDay(member), day);
    }

    function testCannotCheckInTwiceOnSameUtcDay() external {
        vm.warp(1_735_776_000);

        vm.startPrank(member);
        streak.checkIn("gm");

        vm.expectRevert(abi.encodeWithSelector(StreakCheckIn.AlreadyCheckedIn.selector, uint64(block.timestamp / 1 days)));
        streak.checkIn("again");
        vm.stopPrank();
    }

    function testCanCheckInAgainOnNextUtcDay() external {
        vm.warp(1_735_776_000);

        vm.startPrank(member);
        streak.checkIn("day one");

        vm.warp(block.timestamp + 1 days);
        streak.checkIn("day two");
        vm.stopPrank();

        assertEq(streak.lastCheckInDay(member), uint64(block.timestamp / 1 days));
    }

    function testRejectsNotesOver160Bytes() external {
        string memory longNote =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

        vm.expectRevert(abi.encodeWithSelector(StreakCheckIn.NoteTooLong.selector, 161));
        streak.checkIn(longNote);
    }
}

