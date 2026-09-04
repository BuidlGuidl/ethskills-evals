// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/Streak.sol";

contract StreakTest {
    Streak private streak;

    function setUp() public {
        streak = new Streak();
    }

    function testCheckInRecordsTheCurrentDay() public {
        streak.checkIn("gm");
        require(streak.lastCheckInDayPlusOne(address(this)) == uint64(block.timestamp / 1 days) + 1);
    }

    function testCannotCheckInTwiceOnTheSameDay() public {
        streak.checkIn("gm");
        (bool success,) = address(streak).call(abi.encodeCall(Streak.checkIn, ("again")));
        require(!success, "second check-in must revert");
    }
}
