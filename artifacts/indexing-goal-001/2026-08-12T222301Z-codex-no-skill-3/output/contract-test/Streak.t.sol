// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Streak} from "../contracts/Streak.sol";

interface Vm { function warp(uint256) external; function expectRevert(bytes calldata) external; }

contract StreakTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Streak streak = new Streak();

    function testOnlyOncePerUtcDay() public {
        vm.warp(2 days);
        streak.checkIn("gm");
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedIn.selector, 2));
        streak.checkIn("again");
        vm.warp(3 days);
        streak.checkIn("next day");
    }
}
