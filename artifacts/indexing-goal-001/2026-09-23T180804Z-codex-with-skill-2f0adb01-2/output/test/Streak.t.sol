// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Streak} from "../contracts/Streak.sol";

interface Vm {
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract StreakTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Streak internal streak;

    address internal constant ALICE = address(0xA11CE);

    function setUp() external {
        streak = new Streak();
    }

    function testCheckInOncePerDayUpdatesTotalsAndStreaks() external {
        vm.warp(100 days);
        vm.prank(ALICE);
        streak.checkIn("gm");

        assertEq(streak.lastCheckInDay(ALICE), 100);
        assertEq(streak.currentStreak(ALICE), 1);
        assertEq(streak.totalCheckIns(ALICE), 1);
        assertEq(streak.globalCheckIns(), 1);

        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedIn.selector, uint256(100)));
        vm.prank(ALICE);
        streak.checkIn("still gm");

        vm.warp(101 days);
        vm.prank(ALICE);
        streak.checkIn("back again");

        assertEq(streak.currentStreak(ALICE), 2);
        assertEq(streak.totalCheckIns(ALICE), 2);
        assertEq(streak.globalCheckIns(), 2);
    }

    function testGapResetsCurrentStreakButKeepsTotal() external {
        vm.warp(100 days);
        vm.prank(ALICE);
        streak.checkIn("");

        vm.warp(103 days);
        vm.prank(ALICE);
        streak.checkIn("shipped the docs");

        assertEq(streak.lastCheckInDay(ALICE), 103);
        assertEq(streak.currentStreak(ALICE), 1);
        assertEq(streak.totalCheckIns(ALICE), 2);
    }

    function testRejectsNotesOverTheByteLimit() external {
        bytes memory bytesValue = new bytes(streak.MAX_NOTE_BYTES() + 1);
        string memory note = string(bytesValue);

        vm.expectRevert(
            abi.encodeWithSelector(
                Streak.NoteTooLong.selector,
                streak.MAX_NOTE_BYTES() + 1,
                streak.MAX_NOTE_BYTES()
            )
        );
        streak.checkIn(note);
    }

    function assertEq(uint256 actual, uint256 expected) internal pure {
        if (actual != expected) {
            revert("not equal");
        }
    }
}
