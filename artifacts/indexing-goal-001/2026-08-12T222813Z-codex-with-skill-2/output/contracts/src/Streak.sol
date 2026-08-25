// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice One public check-in per address per UTC day.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 280;

    error AlreadyCheckedIn(uint256 day);
    error NoteTooLong(uint256 length);

    event CheckedIn(address indexed member, uint256 indexed day, string note);

    mapping(address member => uint256 dayPlusOne) private lastCheckInDayPlusOne;

    function checkIn(string calldata note) external {
        uint256 length = bytes(note).length;
        if (length > MAX_NOTE_BYTES) revert NoteTooLong(length);

        uint256 day = block.timestamp / 1 days;
        if (lastCheckInDayPlusOne[msg.sender] == day + 1) revert AlreadyCheckedIn(day);

        lastCheckInDayPlusOne[msg.sender] = day + 1;
        emit CheckedIn(msg.sender, day, note);
    }

    function hasCheckedInToday(address member) external view returns (bool) {
        return lastCheckInDayPlusOne[member] == block.timestamp / 1 days + 1;
    }
}
