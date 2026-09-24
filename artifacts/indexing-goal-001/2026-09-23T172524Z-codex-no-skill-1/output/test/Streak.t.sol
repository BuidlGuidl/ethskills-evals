// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Streak} from "../contracts/Streak.sol";

interface Vm {
    function warp(uint256 timestamp) external;
    function expectRevert(bytes4 selector) external;
}

contract StreakTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    Streak private streak;

    function setUp() external {
        streak = new Streak();
    }

    function testCheckInOncePerUtcDay() external {
        vm.warp(100 days);
        streak.checkIn("gm");

        vm.expectRevert(Streak.AlreadyCheckedInToday.selector);
        streak.checkIn("again");
    }

    function testFirstCheckInWorksOnDayZero() external {
        vm.warp(0);
        streak.checkIn("genesis");

        (uint64 totalCheckIns, uint64 currentStreak, uint64 lastCheckInDay) = streak.getMember(address(this));

        require(totalCheckIns == 1, "total");
        require(currentStreak == 1, "streak");
        require(lastCheckInDay == 0, "last day");
    }

    function testCurrentStreakThroughYesterday() external {
        vm.warp(100 days);
        streak.checkIn("one");
        vm.warp(101 days);
        streak.checkIn("two");
        vm.warp(102 days);

        (uint64 totalCheckIns, uint64 currentStreak, uint64 lastCheckInDay) = streak.getMember(address(this));

        require(totalCheckIns == 2, "total");
        require(currentStreak == 2, "streak");
        require(lastCheckInDay == 101, "last day");
    }

    function testStreakExpiresAfterMissedDay() external {
        vm.warp(100 days);
        streak.checkIn("one");
        vm.warp(102 days);

        (, uint64 currentStreak,) = streak.getMember(address(this));

        require(currentStreak == 0, "expired");
    }
}
