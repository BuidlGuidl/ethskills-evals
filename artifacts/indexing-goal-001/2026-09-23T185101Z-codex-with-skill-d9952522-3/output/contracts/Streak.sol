// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice One daily public check-in per address for a community on Base.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 160;
    uint256 private constant DAY_SECONDS = 1 days;

    mapping(address member => uint256 dayNumber) public lastCheckInDay;
    mapping(address member => uint256 count) public totalCheckIns;
    mapping(address member => uint256 streak) public currentStreak;

    event CheckIn(
        address indexed member,
        uint256 indexed dayNumber,
        uint256 checkedAt,
        string note,
        uint256 currentStreak,
        uint256 totalCheckIns
    );

    error AlreadyCheckedIn(address member, uint256 dayNumber);
    error NoteTooLong(uint256 length, uint256 maxLength);

    function checkIn(string calldata note) external {
        bytes calldata noteBytes = bytes(note);
        if (noteBytes.length > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteBytes.length, MAX_NOTE_BYTES);
        }

        uint256 dayNumber = block.timestamp / DAY_SECONDS;
        uint256 previousDay = lastCheckInDay[msg.sender];
        // forge-lint: disable-next-line(block-timestamp)
        if (previousDay == dayNumber) {
            revert AlreadyCheckedIn(msg.sender, dayNumber);
        }

        // forge-lint: disable-next-line(block-timestamp)
        uint256 nextStreak = previousDay + 1 == dayNumber ? currentStreak[msg.sender] + 1 : 1;
        uint256 nextTotal = totalCheckIns[msg.sender] + 1;

        lastCheckInDay[msg.sender] = dayNumber;
        currentStreak[msg.sender] = nextStreak;
        totalCheckIns[msg.sender] = nextTotal;

        emit CheckIn(msg.sender, dayNumber, block.timestamp, note, nextStreak, nextTotal);
    }
}
