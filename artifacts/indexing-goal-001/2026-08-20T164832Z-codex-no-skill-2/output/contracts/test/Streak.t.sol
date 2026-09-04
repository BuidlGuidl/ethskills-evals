// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Streak} from "../src/Streak.sol";

contract StreakTest {
    Streak private streak;

    function setUp() public {
        streak = new Streak();
    }

    function testCheckInRecordsAccountDayAndNote() public {
        streak.checkIn("gm");
        uint64 day = uint64(block.timestamp / 1 days);
        require(streak.lastCheckInDay(address(this)) == day, "day not recorded");
        require(streak.totalCheckIns(address(this)) == 1, "total not recorded");
    }

    function testCannotCheckInTwiceInOneDay() public {
        streak.checkIn("");
        (bool ok,) = address(streak).call(abi.encodeCall(Streak.checkIn, ("again")));
        require(!ok, "second check-in should revert");
    }
}
