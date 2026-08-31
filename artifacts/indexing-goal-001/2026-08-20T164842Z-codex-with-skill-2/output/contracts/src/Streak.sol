// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice One UTC-day check-in per address. The event is the canonical input for the read model.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 280;

    // Stored as day + 1 so the zero value remains the "never checked in" sentinel.
    mapping(address member => uint64 dayPlusOne) public lastCheckInDayPlusOne;

    event CheckIn(address indexed member, uint64 indexed day, string note, uint64 timestamp);

    error AlreadyCheckedInToday(uint64 day);
    error NoteTooLong(uint256 length);

    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong(bytes(note).length);

        uint64 day = uint64(block.timestamp / 1 days);
        if (lastCheckInDayPlusOne[msg.sender] == day + 1) revert AlreadyCheckedInToday(day);

        lastCheckInDayPlusOne[msg.sender] = day + 1;
        emit CheckIn(msg.sender, day, note, uint64(block.timestamp));
    }
}
