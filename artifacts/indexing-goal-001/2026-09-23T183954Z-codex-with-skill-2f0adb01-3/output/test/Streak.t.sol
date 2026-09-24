// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Streak} from "../contracts/Streak.sol";

interface Vm {
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
}

contract StreakTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    Streak private streak;
    address private constant ALICE = address(0xA11CE);

    event CheckedIn(
        address indexed member, uint64 indexed day, uint256 indexed checkInId, string note
    );

    function setUp() public {
        streak = new Streak();
    }

    function testCheckInStoresCountersAndEmitsEvent() public {
        vm.warp(10 days + 123);

        vm.expectEmit(true, true, true, true);
        emit CheckedIn(ALICE, 10, 1, "gm");

        vm.prank(ALICE);
        uint256 checkInId = streak.checkIn("gm");

        _assertEq(checkInId, 1, "check-in id");
        _assertEq(streak.checkInCount(), 1, "global count");
        _assertEq(streak.totalCheckIns(ALICE), 1, "member total");
        _assertEq(streak.lastCheckInDay(ALICE), 10, "last day");
        _assertTrue(streak.hasCheckedIn(ALICE), "has checked in");
    }

    function testRejectsSecondCheckInOnSameUtcDay() public {
        vm.warp(15 days + 1 hours);
        vm.prank(ALICE);
        streak.checkIn("first");

        vm.warp(15 days + 23 hours);
        vm.expectRevert(abi.encodeWithSelector(Streak.AlreadyCheckedIn.selector, ALICE, uint64(15)));
        vm.prank(ALICE);
        streak.checkIn("again");
    }

    function testAllowsCheckInOnNextUtcDay() public {
        vm.warp(20 days + 23 hours);
        vm.prank(ALICE);
        streak.checkIn("late");

        vm.warp(21 days);
        vm.prank(ALICE);
        streak.checkIn("new day");

        _assertEq(streak.totalCheckIns(ALICE), 2, "member total");
        _assertEq(streak.lastCheckInDay(ALICE), 21, "last day");
    }

    function testRejectsNoteOverByteLimit() public {
        bytes memory payload = new bytes(streak.MAX_NOTE_BYTES() + 1);
        for (uint256 i = 0; i < payload.length; i++) {
            payload[i] = "a";
        }

        vm.expectRevert(
            abi.encodeWithSelector(
                Streak.NoteTooLong.selector, payload.length, streak.MAX_NOTE_BYTES()
            )
        );
        vm.prank(ALICE);
        streak.checkIn(string(payload));
    }

    function _assertEq(uint256 actual, uint256 expected, string memory label) private pure {
        if (actual != expected) {
            revert(string.concat(label, " mismatch"));
        }
    }

    function _assertTrue(bool value, string memory label) private pure {
        if (!value) {
            revert(string.concat(label, " false"));
        }
    }
}
