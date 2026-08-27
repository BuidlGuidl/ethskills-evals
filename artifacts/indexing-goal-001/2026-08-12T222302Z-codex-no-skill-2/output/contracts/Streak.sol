// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Streak
/// @notice One public check-in per address per UTC day.
contract Streak {
    error AlreadyCheckedIn(uint256 day);
    error NoteTooLong();

    uint256 public constant MAX_NOTE_BYTES = 280;
    mapping(address member => uint256 day) public lastCheckInDay;

    event CheckedIn(address indexed member, uint256 indexed day, uint256 timestamp, string note);

    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong();

        uint256 day = block.timestamp / 1 days;
        if (lastCheckInDay[msg.sender] == day) revert AlreadyCheckedIn(day);
        lastCheckInDay[msg.sender] = day;

        emit CheckedIn(msg.sender, day, block.timestamp, note);
    }
}

